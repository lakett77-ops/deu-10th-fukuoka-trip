import { Dispatch, FormEvent, SetStateAction, useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import type { ChecklistItem, ChecklistKind, PreflightCheckItem, TravelAppData } from "../../types";
import { createId } from "../../utils/id";

interface ChecklistPageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
}

const kinds: ChecklistKind[] = ["개인", "공용"];
const emptyForm = (ownerId: string): Omit<ChecklistItem, "id"> => ({
  name: "",
  kind: "개인",
  ownerId,
  done: false,
  memo: "",
});
const emptyPreflightForm: Omit<PreflightCheckItem, "id"> = {
  name: "",
  done: false,
  memo: "",
};

export default function ChecklistPage({ data, setData }: ChecklistPageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ChecklistItem, "id">>(() => emptyForm(data.participants[0]?.id ?? ""));
  const [preflightModalOpen, setPreflightModalOpen] = useState(false);
  const [editingPreflightId, setEditingPreflightId] = useState<string | null>(null);
  const [preflightForm, setPreflightForm] = useState<Omit<PreflightCheckItem, "id">>(emptyPreflightForm);

  const participantName = (id: string) => data.participants.find((participant) => participant.id === id)?.name ?? "미정";
  const completedCount =
    data.checklists.filter((item) => item.done).length + data.preflightChecks.filter((item) => item.done).length;
  const totalCount = data.checklists.length + data.preflightChecks.length;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(data.participants[0]?.id ?? ""));
    setModalOpen(true);
  };

  const openEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      kind: item.kind,
      ownerId: item.ownerId,
      done: item.done,
      memo: item.memo,
    });
    setModalOpen(true);
  };

  const openCreatePreflight = () => {
    setEditingPreflightId(null);
    setPreflightForm(emptyPreflightForm);
    setPreflightModalOpen(true);
  };

  const openEditPreflight = (item: PreflightCheckItem) => {
    setEditingPreflightId(item.id);
    setPreflightForm({
      name: item.name,
      done: item.done,
      memo: item.memo,
    });
    setPreflightModalOpen(true);
  };

  const saveItem = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    setData((current) => ({
      ...current,
      checklists: editingId
        ? current.checklists.map((item) => (item.id === editingId ? { ...form, id: editingId } : item))
        : [...current.checklists, { ...form, id: createId("checklist") }],
    }));
    setModalOpen(false);
  };

  const savePreflight = (event: FormEvent) => {
    event.preventDefault();
    if (!preflightForm.name.trim()) return;

    setData((current) => ({
      ...current,
      preflightChecks: editingPreflightId
        ? current.preflightChecks.map((item) => (item.id === editingPreflightId ? { ...preflightForm, id: editingPreflightId } : item))
        : [...current.preflightChecks, { ...preflightForm, id: createId("preflight") }],
    }));
    setPreflightModalOpen(false);
  };

  const toggleDone = (itemId: string) => {
    setData((current) => ({
      ...current,
      checklists: current.checklists.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    }));
  };

  const togglePreflightDone = (itemId: string) => {
    setData((current) => ({
      ...current,
      preflightChecks: current.preflightChecks.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)),
    }));
  };

  const deleteItem = (itemId: string) => {
    if (!confirm("이 준비물을 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      checklists: current.checklists.filter((item) => item.id !== itemId),
    }));
  };

  const deletePreflight = (itemId: string) => {
    if (!confirm("이 필수 확인 항목을 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      preflightChecks: current.preflightChecks.filter((item) => item.id !== itemId),
    }));
  };

  const deleteAllPreflight = () => {
    if (!confirm("출국 전 필수 확인 항목을 전체 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      preflightChecks: [],
    }));
  };

  const deleteAllChecklistByKind = (kind: ChecklistKind) => {
    if (!confirm(`${kind} 준비물을 전체 삭제할까요?`)) return;
    setData((current) => ({
      ...current,
      checklists: current.checklists.filter((item) => item.kind !== kind),
    }));
  };

  const resetChecklist = () => {
    if (!confirm("준비물 섹션을 하드 리셋할까요? 모든 준비물 완료 체크가 해제됩니다.")) return;
    setData((current) => ({
      ...current,
      checklists: current.checklists.map((item) => ({ ...item, done: false })),
      preflightChecks: current.preflightChecks.map((item) => ({ ...item, done: false })),
    }));
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-teal-600">준비물</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">출국 전 체크리스트 ✈️</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {completedCount}/{totalCount}개 완료
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={resetChecklist}
            className="grid h-12 w-12 place-items-center rounded-lg bg-white text-rose-600 shadow-sm"
            aria-label="준비물 섹션 하드 리셋"
          >
            <RotateCcw size={19} />
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

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-black text-slate-900">출국 전 필수 확인</h2>
          <div className="flex shrink-0 gap-2">
            {data.preflightChecks.length > 0 && (
              <button
                type="button"
                onClick={deleteAllPreflight}
                className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600"
                aria-label="필수 확인 항목 전체 삭제"
              >
                <Trash2 size={17} />
              </button>
            )}
            <button
              type="button"
              onClick={openCreatePreflight}
              className="grid h-10 w-10 place-items-center rounded-lg bg-teal-500 text-white"
              aria-label="필수 확인 항목 추가"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        {data.preflightChecks.length ? (
          <div className="mt-3 space-y-2">
            {data.preflightChecks.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg p-3 ${item.done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => togglePreflightDone(item.id)}
                    className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${
                      item.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-amber-300 bg-white"
                    }`}
                    aria-label="필수 확인 완료 체크"
                  >
                    {item.done ? "✓" : ""}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-black">
                      {item.done ? "완료" : "확인 필요"} · {item.name}
                    </p>
                    {item.memo && <p className="mt-1 whitespace-pre-wrap break-words text-xs font-bold opacity-80">{item.memo}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEditPreflight(item)}
                      className="grid h-9 w-9 place-items-center rounded-lg bg-white/80 text-slate-600"
                      aria-label="필수 확인 항목 수정"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePreflight(item.id)}
                      className="grid h-9 w-9 place-items-center rounded-lg bg-white/80 text-rose-600"
                      aria-label="필수 확인 항목 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState icon="✈️" title="필수 확인 항목이 비어 있어요" description="여권, 항공권, eSIM 같은 항목을 추가해보세요." />
          </div>
        )}
      </Card>

      {kinds.map((kind) => {
        const items = data.checklists.filter((item) => item.kind === kind);
        return (
          <section key={kind} className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-lg font-black text-slate-900">{kind} 준비물</h2>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => deleteAllChecklistByKind(kind)}
                  className="h-9 rounded-lg bg-rose-50 px-3 text-xs font-black text-rose-600"
                  aria-label={`${kind} 준비물 전체 삭제`}
                >
                  전체 삭제
                </button>
              )}
            </div>
            {items.length ? (
              items.map((item) => (
                <Card key={item.id}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleDone(item.id)}
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 ${
                        item.done ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 bg-white"
                      }`}
                      aria-label="완료 체크"
                    >
                      {item.done ? "✓" : ""}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`break-words text-lg font-black ${item.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {item.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">담당자 · {participantName(item.ownerId)}</p>
                      {item.memo && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{item.memo}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600"
                        aria-label="준비물 수정"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600"
                        aria-label="준비물 삭제"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <EmptyState icon={kind === "개인" ? "🎒" : "🍻"} title={`${kind} 준비물이 비어 있어요`} description="필요한 물건을 추가해보세요." />
            )}
          </section>
        );
      })}

      <Modal title={editingId ? "준비물 수정" : "준비물 추가"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveItem} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">준비물 이름</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">구분</span>
            <select
              value={form.kind}
              onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as ChecklistKind }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {kinds.map((kind) => (
                <option key={kind}>{kind}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">담당자</span>
            <select
              value={form.ownerId}
              onChange={(event) => setForm((current) => ({ ...current, ownerId: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-12 items-center justify-between rounded-lg border border-slate-200 px-3">
            <span className="font-bold text-slate-700">완료 여부</span>
            <input
              type="checkbox"
              checked={form.done}
              onChange={(event) => setForm((current) => ({ ...current, done: event.target.checked }))}
              className="h-5 w-5 accent-teal-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">메모</span>
            <textarea
              value={form.memo}
              onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 p-3"
            />
          </label>
          <button type="submit" className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            저장
          </button>
        </form>
      </Modal>

      <Modal title={editingPreflightId ? "필수 확인 수정" : "필수 확인 추가"} open={preflightModalOpen} onClose={() => setPreflightModalOpen(false)}>
        <form onSubmit={savePreflight} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">항목 이름</span>
            <input
              value={preflightForm.name}
              onChange={(event) => setPreflightForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="예: 항공권"
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="flex min-h-12 items-center justify-between rounded-lg border border-slate-200 px-3">
            <span className="font-bold text-slate-700">완료 여부</span>
            <input
              type="checkbox"
              checked={preflightForm.done}
              onChange={(event) => setPreflightForm((current) => ({ ...current, done: event.target.checked }))}
              className="h-5 w-5 accent-teal-500"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">메모</span>
            <textarea
              value={preflightForm.memo}
              onChange={(event) => setPreflightForm((current) => ({ ...current, memo: event.target.value }))}
              rows={3}
              placeholder="확인할 내용을 적어두세요."
              className="mt-1 w-full rounded-lg border border-slate-200 p-3"
            />
          </label>
          <button type="submit" className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            저장
          </button>
        </form>
      </Modal>
    </div>
  );
}
