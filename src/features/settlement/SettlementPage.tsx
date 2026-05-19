import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import type { Expense, ExpenseCategory, ExpenseShare, TravelAppData } from "../../types";
import { calculateSettlement, convertJPYToKRW, formatKRW, getExpenseShareBreakdown } from "../../utils/settlement";
import { createId } from "../../utils/id";

interface SettlementPageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
}

const categories: ExpenseCategory[] = ["항공", "숙소", "식사", "술", "교통", "쇼핑공용", "액티비티", "기타"];
const splitModes = ["균등 분할", "개인별 금액"] as const;

const categoryTone: Record<ExpenseCategory, string> = {
  항공: "bg-sky-100 text-sky-700",
  숙소: "bg-teal-100 text-teal-700",
  식사: "bg-orange-100 text-orange-700",
  술: "bg-rose-100 text-rose-700",
  교통: "bg-emerald-100 text-emerald-700",
  쇼핑공용: "bg-violet-100 text-violet-700",
  액티비티: "bg-cyan-100 text-cyan-700",
  기타: "bg-slate-100 text-slate-600",
};

const getCustomTotalKRW = (shares: ExpenseShare[] = []) =>
  shares.reduce((sum, share) => sum + Math.max(0, Number(share.amountKRW) || 0), 0);

const getCustomTotalJPY = (shares: ExpenseShare[] = []) =>
  shares.reduce((sum, share) => sum + Math.max(0, Number(share.amountJPY) || 0), 0);

const formatJPY = (amount: number) => `¥${Math.round(amount).toLocaleString("ja-JP")}`;

const krwToJPY = (amountKRW: number, exchangeRate: number) =>
  exchangeRate > 0 ? Math.round(amountKRW / exchangeRate) : 0;

const formatApproxJPY = (amountKRW: number, exchangeRate: number) =>
  exchangeRate > 0 ? `엔화 약 ${formatJPY(krwToJPY(amountKRW, exchangeRate))}` : "엔화 환율 확인 필요";

const getExpenseJPYTotal = (expense: Expense, totalKRW: number, fallbackExchangeRate: number) => {
  const customTotalJPY = getCustomTotalJPY(expense.customShares);
  if (expense.splitMode === "개인별 금액" && customTotalJPY > 0) return customTotalJPY;
  if (expense.amountJPY && expense.amountJPY > 0) return expense.amountJPY;

  const exchangeRate = expense.exchangeRate || fallbackExchangeRate;
  return exchangeRate > 0 ? Math.round(totalKRW / exchangeRate) : 0;
};

const getExpenseTotal = (expense: Expense) => {
  if (expense.splitMode === "개인별 금액") {
    const customTotal = getCustomTotalKRW(expense.customShares);
    if (customTotal > 0) return customTotal;
  }

  return expense.amountKRW;
};

const makeShares = (
  participantIds: string[],
  amountKRW = 0,
  amountJPY: number | undefined = undefined,
): ExpenseShare[] => {
  const count = Math.max(1, participantIds.length);
  const shareKRW = amountKRW > 0 ? Math.round(amountKRW / count) : 0;
  const shareJPY = amountJPY && amountJPY > 0 ? Math.round(amountJPY / count) : undefined;

  return participantIds.map((participantId) => ({
    participantId,
    amountKRW: shareKRW,
    amountJPY: shareJPY,
  }));
};

const emptyExpense = (payerId: string, participantIds: string[], exchangeRate: number): Omit<Expense, "id"> => ({
  title: "",
  amountKRW: 0,
  amountJPY: undefined,
  exchangeRate,
  payerId,
  participantIds,
  splitMode: "균등 분할",
  customShares: makeShares(participantIds),
  category: "식사",
  memo: "",
});

export default function SettlementPage({ data, setData }: SettlementPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Expense, "id">>(() =>
    emptyExpense(data.participants[0]?.id ?? "", data.participants.map((participant) => participant.id), data.settings.exchangeRate),
  );

  const settlement = useMemo(
    () => calculateSettlement(data.expenses, data.participants),
    [data.expenses, data.participants],
  );
  const participantById = useMemo(
    () => new Map(data.participants.map((participant) => [participant.id, participant])),
    [data.participants],
  );
  const customTotalKRW = getCustomTotalKRW(form.customShares);
  const customTotalJPY = getCustomTotalJPY(form.customShares);
  const effectiveAmountKRW = form.splitMode === "개인별 금액" ? customTotalKRW : form.amountKRW;
  const baseExchangeRate = data.settings.exchangeRate;
  const effectiveAmountJPY =
    form.splitMode === "개인별 금액"
      ? customTotalJPY || krwToJPY(effectiveAmountKRW, form.exchangeRate ?? baseExchangeRate)
      : form.amountJPY || krwToJPY(effectiveAmountKRW, form.exchangeRate ?? baseExchangeRate);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyExpense(data.participants[0]?.id ?? "", data.participants.map((participant) => participant.id), data.settings.exchangeRate));
    setModalOpen(true);
  };

  const openEdit = (expense: Expense) => {
    const participantIds = expense.participantIds.length
      ? expense.participantIds
      : data.participants.map((participant) => participant.id);
    const customShares = expense.customShares?.length
      ? expense.customShares
      : makeShares(participantIds, expense.amountKRW, expense.amountJPY);

    setEditingId(expense.id);
    setForm({
      title: expense.title,
      amountKRW: getExpenseTotal(expense),
      amountJPY: expense.amountJPY,
      exchangeRate: expense.exchangeRate ?? data.settings.exchangeRate,
      payerId: expense.payerId,
      participantIds,
      splitMode: expense.splitMode ?? "균등 분할",
      customShares,
      category: expense.category,
      memo: expense.memo,
    });
    setModalOpen(true);
  };

  const saveExpense = (event: FormEvent) => {
    event.preventDefault();

    const splitMode = form.splitMode ?? "균등 분할";
    const normalizedShares = (form.customShares ?? []).filter((share) => form.participantIds.includes(share.participantId));
    const amountKRW = splitMode === "개인별 금액" ? getCustomTotalKRW(normalizedShares) : form.amountKRW;
    const amountJPY = splitMode === "개인별 금액" ? getCustomTotalJPY(normalizedShares) || undefined : form.amountJPY;

    if (!form.title.trim() || amountKRW <= 0 || !form.participantIds.length) return;

    const expenseToSave: Omit<Expense, "id"> = {
      ...form,
      amountKRW,
      amountJPY,
      customShares: normalizedShares,
    };

    setData((current) => ({
      ...current,
      expenses: editingId
        ? current.expenses.map((expense) => (expense.id === editingId ? { ...expenseToSave, id: editingId } : expense))
        : [...current.expenses, { ...expenseToSave, id: createId("expense") }],
    }));
    setModalOpen(false);
  };

  const deleteExpense = (expenseId: string) => {
    if (!confirm("이 비용 항목을 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      expenses: current.expenses.filter((expense) => expense.id !== expenseId),
    }));
  };

  const deleteAllExpenses = () => {
    if (!confirm("정산 비용 항목을 전체 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      expenses: [],
    }));
  };

  const updateParticipantAccount = (
    participantId: string,
    patch: Partial<Pick<TravelAppData["participants"][number], "bankName" | "accountNumber">>,
  ) => {
    setData((current) => ({
      ...current,
      participants: current.participants.map((participant) =>
        participant.id === participantId ? { ...participant, ...patch } : participant,
      ),
    }));
  };

  const copyAccount = async (bankName: string, accountNumber: string) => {
    const accountText = [bankName, accountNumber].filter(Boolean).join(" ").trim();
    if (!accountText) return;
    await navigator.clipboard?.writeText(accountText);
    alert("은행명과 계좌번호를 복사했어요.");
  };

  const updateJPY = (amountJPY: number | undefined, exchangeRate = form.exchangeRate ?? data.settings.exchangeRate) => {
    setForm((current) => ({
      ...current,
      amountJPY,
      exchangeRate,
      amountKRW: amountJPY ? convertJPYToKRW(amountJPY, exchangeRate) : current.amountKRW,
    }));
  };

  const setSplitMode = (splitMode: Expense["splitMode"]) => {
    setForm((current) => ({
      ...current,
      splitMode,
      customShares:
        splitMode === "개인별 금액"
          ? makeShares(current.participantIds, current.amountKRW, current.amountJPY)
          : current.customShares,
    }));
  };

  const toggleParticipant = (participantId: string) => {
    setForm((current) => {
      const included = current.participantIds.includes(participantId);
      const participantIds = included
        ? current.participantIds.filter((id) => id !== participantId)
        : [...current.participantIds, participantId];
      const customShares = included
        ? (current.customShares ?? []).filter((share) => share.participantId !== participantId)
        : [
            ...(current.customShares ?? []),
            {
              participantId,
              amountKRW: 0,
              amountJPY: undefined,
            },
          ];

      return {
        ...current,
        participantIds,
        customShares,
      };
    });
  };

  const updateCustomShare = (participantId: string, patch: Partial<ExpenseShare>) => {
    setForm((current) => {
      const shares = current.customShares ?? [];
      const exists = shares.some((share) => share.participantId === participantId);
      const customShares = exists
        ? shares.map((share) => (share.participantId === participantId ? { ...share, ...patch } : share))
        : [...shares, { participantId, amountKRW: 0, ...patch }];

      return {
        ...current,
        customShares,
      };
    });
  };

  const updateCustomJPY = (participantId: string, amountJPY: number | undefined) => {
    const exchangeRate = form.exchangeRate ?? data.settings.exchangeRate;
    updateCustomShare(participantId, {
      amountJPY,
      amountKRW: amountJPY ? convertJPYToKRW(amountJPY, exchangeRate) : 0,
    });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-teal-600">정산</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">후쿠오카 비용 계산기 💴</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={deleteAllExpenses}
            className="grid h-12 w-12 place-items-center rounded-lg bg-white text-rose-600 shadow-sm"
            aria-label="정산 비용 전체 삭제"
          >
            <Trash2 size={19} />
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-12 items-center gap-2 rounded-lg bg-teal-500 px-4 font-bold text-white shadow-soft"
          >
            <Plus size={19} />
            추가
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs font-bold text-slate-500">총 비용</p>
          <p className="mt-1 text-xl font-black text-slate-900">{formatKRW(settlement.total)}</p>
          <p className="mt-1 text-sm font-black text-teal-700">{formatApproxJPY(settlement.total, baseExchangeRate)}</p>
        </Card>
        <Card>
          <p className="text-xs font-bold text-slate-500">1인 평균</p>
          <p className="mt-1 text-xl font-black text-slate-900">{formatKRW(settlement.averagePerParticipant)}</p>
          <p className="mt-1 text-sm font-black text-teal-700">{formatApproxJPY(settlement.averagePerParticipant, baseExchangeRate)}</p>
        </Card>
      </div>

      <Card>
        <h2 className="font-black text-slate-900">개인별 내역과 송금 안내</h2>
        <div className="mt-3 space-y-2">
          {settlement.people.map((person) => {
            const participant = participantById.get(person.participantId);
            const outgoingTransfers = settlement.transfers.filter((transfer) => transfer.fromId === person.participantId);
            const incomingTransfers = settlement.transfers.filter((transfer) => transfer.toId === person.participantId);
            const balanceLabel =
              person.balance > 0 ? "받을 돈" : person.balance < 0 ? "보낼 돈" : "정산 완료";
            const balanceTone =
              person.balance > 0 ? "text-emerald-700" : person.balance < 0 ? "text-rose-600" : "text-slate-500";
            return (
              <div key={person.participantId} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-slate-900">{participant?.name ?? "알 수 없음"}</p>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-black ${balanceTone}`}>
                      {balanceLabel} {person.balance === 0 ? "" : formatKRW(Math.abs(person.balance))}
                    </p>
                    {person.balance !== 0 && (
                      <p className={`text-xs font-bold ${balanceTone}`}>
                        {formatApproxJPY(Math.abs(person.balance), baseExchangeRate)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-bold text-slate-500">
                  <span>
                    <span className="block">결제 {formatKRW(person.paid)}</span>
                    <span className="block text-teal-700">{formatApproxJPY(person.paid, baseExchangeRate)}</span>
                  </span>
                  <span>
                    <span className="block">부담 {formatKRW(person.share)}</span>
                    <span className="block text-teal-700">{formatApproxJPY(person.share, baseExchangeRate)}</span>
                  </span>
                </div>

                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">송금 안내</p>
                  <div className="mt-2 space-y-2">
                    {outgoingTransfers.map((transfer) => {
                      const to = participantById.get(transfer.toId);
                      return (
                        <div key={`out-${transfer.toId}-${transfer.amount}`} className="rounded-lg bg-rose-50 p-3">
                          <p className="break-words text-sm font-black text-slate-900">
                            {participant?.name ?? "알 수 없음"} → {to?.name ?? "알 수 없음"}에게 보내기
                          </p>
                          <p className="mt-1 text-base font-black text-rose-600">{formatKRW(transfer.amount)}</p>
                          <p className="text-xs font-bold text-rose-600">{formatApproxJPY(transfer.amount, baseExchangeRate)}</p>
                        </div>
                      );
                    })}
                    {incomingTransfers.map((transfer) => {
                      const from = participantById.get(transfer.fromId);
                      return (
                        <div key={`in-${transfer.fromId}-${transfer.amount}`} className="rounded-lg bg-emerald-50 p-3">
                          <p className="break-words text-sm font-black text-slate-900">
                            {from?.name ?? "알 수 없음"} → {participant?.name ?? "알 수 없음"}에게 보내야 함
                          </p>
                          <p className="mt-1 text-base font-black text-emerald-700">{formatKRW(transfer.amount)}</p>
                          <p className="text-xs font-bold text-emerald-700">{formatApproxJPY(transfer.amount, baseExchangeRate)}</p>
                        </div>
                      );
                    })}
                    {!outgoingTransfers.length && !incomingTransfers.length && (
                      <p className="rounded-lg bg-white p-3 text-sm font-bold text-slate-500">
                        이 멤버는 현재 주고받을 송금이 없어요.
                      </p>
                    )}
                  </div>
                </div>

                {participant && (
                  <div className="mt-3 rounded-lg bg-teal-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-500">{participant.name} 계좌</p>
                      <button
                        type="button"
                        onClick={() => copyAccount(participant.bankName, participant.accountNumber)}
                        className="flex h-9 items-center gap-1 rounded-lg bg-teal-500 px-3 text-xs font-black text-white"
                      >
                        <Copy size={15} />
                        복사
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500">은행명</span>
                        <input
                          value={participant.bankName}
                          onChange={(event) => updateParticipantAccount(participant.id, { bankName: event.target.value })}
                          placeholder="카카오뱅크"
                          className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-500">계좌번호</span>
                        <input
                          value={participant.accountNumber}
                          onChange={(event) => updateParticipantAccount(participant.id, { accountNumber: event.target.value })}
                          placeholder="3333-01-1234567"
                          className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="px-1 text-lg font-black text-slate-900">비용 항목</h2>
        {data.expenses.length ? (
          data.expenses.map((expense) => {
            const payer = participantById.get(expense.payerId);
            const total = getExpenseTotal(expense);
            const exchangeRate = expense.exchangeRate ?? data.settings.exchangeRate;
            const totalJPY = getExpenseJPYTotal(expense, total, data.settings.exchangeRate);
            const shareBreakdown = getExpenseShareBreakdown(expense, data.settings.exchangeRate);
            return (
              <Card key={expense.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-black ${categoryTone[expense.category]}`}>
                        {expense.category}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                        {expense.splitMode ?? "균등 분할"}
                      </span>
                    </div>
                    <h3 className="mt-2 break-words text-lg font-black text-slate-900">{expense.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">결제자 · {payer?.name ?? "알 수 없음"}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(expense)}
                      className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600"
                      aria-label="비용 수정"
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteExpense(expense.id)}
                      className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600"
                      aria-label="비용 삭제"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <p className="text-xl font-black text-slate-900">{formatKRW(total)}</p>
                  <p className="mt-1 text-sm font-black text-teal-700">
                    {expense.amountJPY || getCustomTotalJPY(expense.customShares) > 0 ? "엔화" : "엔화 약"} {formatJPY(totalJPY)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">적용 환율 {exchangeRate}</p>
                </div>
                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-slate-500">참여자별 부담</p>
                    <p className="text-xs font-bold text-slate-400">참여자 {shareBreakdown.length}명</p>
                  </div>
                  {shareBreakdown.length ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {shareBreakdown.map((share) => {
                        const shareParticipant = participantById.get(share.participantId);
                        return (
                          <div key={`${expense.id}-${share.participantId}`} className="rounded-lg bg-white p-2">
                            <p className="break-words text-sm font-black text-slate-900">
                              {shareParticipant?.name ?? "알 수 없음"}
                            </p>
                            <p className="mt-1 text-sm font-black text-slate-900">{formatKRW(share.amountKRW)}</p>
                            <p className="text-xs font-bold text-teal-700">
                              {share.amountJPY ? formatJPY(share.amountJPY) : formatApproxJPY(share.amountKRW, exchangeRate)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 rounded-lg bg-white p-3 text-sm font-bold text-slate-500">
                      참여자 정보가 아직 없어요.
                    </p>
                  )}
                </div>
                {expense.memo && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{expense.memo}</p>}
              </Card>
            );
          })
        ) : (
          <EmptyState icon="💴" title="비용 항목이 없어요" description="숙소비, 라멘, 이자카야부터 추가해보세요." />
        )}
      </section>

      <Modal title={editingId ? "비용 수정" : "비용 추가"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveExpense} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">제목</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="예: 신신라멘"
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>

          <div>
            <p className="text-sm font-bold text-slate-700">정산 방식</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {splitModes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSplitMode(mode)}
                  className={`h-11 rounded-lg text-sm font-black ${
                    form.splitMode === mode ? "bg-teal-500 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">결제자</span>
            <select
              value={form.payerId}
              onChange={(event) => setForm((current) => ({ ...current, payerId: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-700">카테고리</span>
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ExpenseCategory }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          {form.splitMode === "개인별 금액" ? (
            <div className="space-y-3 rounded-lg bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">개인별 주문 금액</p>
                  <p className="mt-1 text-xs text-slate-500">예: 1000엔, 1200엔처럼 각자 먹은 금액을 입력</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-slate-500">합계</p>
                  <p className="font-black text-teal-700">{formatKRW(customTotalKRW)}</p>
                  <p className="text-xs font-black text-teal-700">
                    {customTotalJPY > 0 ? formatJPY(customTotalJPY) : formatApproxJPY(customTotalKRW, form.exchangeRate ?? baseExchangeRate)}
                  </p>
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">환율</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.exchangeRate ?? data.settings.exchangeRate}
                  onChange={(event) => {
                    const exchangeRate = Number(event.target.value);
                    setForm((current) => ({
                      ...current,
                      exchangeRate,
                      customShares: (current.customShares ?? []).map((share) => ({
                        ...share,
                        amountKRW: share.amountJPY ? convertJPYToKRW(share.amountJPY, exchangeRate) : share.amountKRW,
                      })),
                    }));
                  }}
                  className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
                />
              </label>
              <div className="space-y-2">
                {data.participants.map((participant) => {
                  const included = form.participantIds.includes(participant.id);
                  const share = form.customShares?.find((item) => item.participantId === participant.id);
                  return (
                    <div key={participant.id} className="rounded-lg bg-white p-3">
                      <label className="flex items-center gap-2 font-black text-slate-900">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => toggleParticipant(participant.id)}
                          className="h-5 w-5 accent-teal-500"
                        />
                        {participant.name}
                      </label>
                      {included && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-xs font-bold text-slate-500">엔화</span>
                            <input
                              type="number"
                              min="0"
                              value={share?.amountJPY ?? ""}
                              onChange={(event) => updateCustomJPY(participant.id, event.target.value ? Number(event.target.value) : undefined)}
                              placeholder="1000"
                              className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-bold text-slate-500">원화</span>
                            <input
                              type="number"
                              min="0"
                              value={share?.amountKRW ?? 0}
                              onChange={(event) =>
                                updateCustomShare(participant.id, {
                                  amountKRW: Number(event.target.value),
                                  amountJPY: share?.amountJPY,
                                })
                              }
                              className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {customTotalJPY > 0 && (
                <p className="text-right text-sm font-bold text-slate-500">
                  ¥{customTotalJPY.toLocaleString()} · 환산 {formatKRW(customTotalKRW)}
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">JPY 금액</span>
                  <input
                    type="number"
                    min="0"
                    value={form.amountJPY ?? ""}
                    onChange={(event) => updateJPY(event.target.value ? Number(event.target.value) : undefined)}
                    className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">환율</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.exchangeRate ?? data.settings.exchangeRate}
                    onChange={(event) => updateJPY(form.amountJPY, Number(event.target.value))}
                    className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">KRW 환산/입력 금액</span>
                <input
                  type="number"
                  min="0"
                  value={form.amountKRW}
                  onChange={(event) => setForm((current) => ({ ...current, amountKRW: Number(event.target.value) }))}
                  className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
                />
              </label>
              <div>
                <p className="text-sm font-bold text-slate-700">참여자 목록</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {data.participants.map((participant) => (
                    <label key={participant.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold">
                      <input
                        type="checkbox"
                        checked={form.participantIds.includes(participant.id)}
                        onChange={() => toggleParticipant(participant.id)}
                        className="h-4 w-4 accent-teal-500"
                      />
                      <span className="break-words">{participant.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <label className="block">
            <span className="text-sm font-bold text-slate-700">메모</span>
            <textarea
              value={form.memo}
              onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 p-3"
            />
          </label>

          <div className="rounded-lg bg-teal-50 p-3 text-sm font-bold text-teal-700">
            <p>저장될 총액 · {formatKRW(effectiveAmountKRW)}</p>
            <p className="mt-1">
              {effectiveAmountJPY ? `엔화 ${formatJPY(effectiveAmountJPY)}` : formatApproxJPY(effectiveAmountKRW, form.exchangeRate ?? baseExchangeRate)}
            </p>
          </div>

          <button type="submit" className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            저장
          </button>
        </form>
      </Modal>
    </div>
  );
}
