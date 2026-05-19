import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";
import { ArrowLeft, Copy, MessageSquarePlus, Pencil, RotateCcw, Trash2 } from "lucide-react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import type { AttendanceStatus, Participant, TravelAppData } from "../../types";
import { formatDateTime } from "../../utils/date";
import { createId } from "../../utils/id";

interface ParticipantsPageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
  onBack: () => void;
}

const statuses: AttendanceStatus[] = ["확정", "미정", "불참", "중간 합류", "중간 이탈"];
const statusTone: Record<AttendanceStatus, string> = {
  확정: "bg-emerald-100 text-emerald-700 border-emerald-200",
  미정: "bg-amber-100 text-amber-700 border-amber-200",
  불참: "bg-slate-100 text-slate-600 border-slate-200",
  "중간 합류": "bg-sky-100 text-sky-700 border-sky-200",
  "중간 이탈": "bg-rose-100 text-rose-700 border-rose-200",
};

const emptyMessage = {
  authorParticipantId: "",
  content: "",
};

export default function ParticipantsPage({ data, setData, onBack }: ParticipantsPageProps) {
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [messageTargetId, setMessageTargetId] = useState<string | null>(null);
  const [messageForm, setMessageForm] = useState(emptyMessage);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});

  const participantById = useMemo(
    () => new Map(data.participants.map((participant) => [participant.id, participant])),
    [data.participants],
  );

  const copyAccount = async (accountNumber: string) => {
    if (!accountNumber) return;
    await navigator.clipboard?.writeText(accountNumber);
    alert("계좌번호를 복사했어요.");
  };

  const openMessageModal = (participantId: string) => {
    setMessageTargetId(participantId);
    setMessageForm({
      authorParticipantId: data.participants[0]?.id ?? "",
      content: "",
    });
  };

  const saveParticipant = (event: FormEvent) => {
    event.preventDefault();
    if (!editingParticipant?.name.trim()) return;

    setData((current) => ({
      ...current,
      participants: current.participants.map((participant) =>
        participant.id === editingParticipant.id ? editingParticipant : participant,
      ),
    }));
    setEditingParticipant(null);
  };

  const saveMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!messageTargetId || !messageForm.authorParticipantId || !messageForm.content.trim()) return;

    setData((current) => ({
      ...current,
      participantMessages: [
        {
          id: createId("message"),
          targetParticipantId: messageTargetId,
          authorParticipantId: messageForm.authorParticipantId,
          createdAt: new Date().toISOString(),
          content: messageForm.content.trim(),
        },
        ...current.participantMessages,
      ],
    }));
    setMessageTargetId(null);
  };

  const deleteMessage = (messageId: string) => {
    if (!confirm("이 메시지를 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      participantMessages: current.participantMessages.filter((message) => message.id !== messageId),
    }));
  };

  const deleteAllMessagesForParticipant = (participantId: string) => {
    if (!confirm("이 멤버 카드의 메시지를 전체 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      participantMessages: current.participantMessages.filter((message) => message.targetParticipantId !== participantId),
    }));
  };

  const resetParticipants = () => {
    if (!confirm("참석자 섹션을 하드 리셋할까요? 이름만 남기고 참석 상태, 별명, 메모, 교통수단, 계좌 정보가 비워집니다.")) return;
    setData((current) => ({
      ...current,
      participants: current.participants.map((participant) => ({
        ...participant,
        nickname: "",
        status: "미정",
        flightBooked: false,
        accommodationPaid: false,
        passportChecked: false,
        transport: "",
        memo: "",
        bankName: "",
        accountNumber: "",
      })),
      participantMessages: [],
    }));
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-lg bg-white shadow-sm" aria-label="뒤로">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-teal-600">참석자</p>
          <h1 className="text-2xl font-black text-slate-900">멤버별 메시지 보드</h1>
        </div>
        <button
          type="button"
          onClick={resetParticipants}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-rose-600 shadow-sm"
          aria-label="참석자 섹션 하드 리셋"
        >
          <RotateCcw size={19} />
        </button>
      </header>

      <div className="space-y-3">
        {data.participants.map((participant) => {
          const messages = data.participantMessages
            .filter((message) => message.targetParticipantId === participant.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const expanded = expandedMessages[participant.id] ?? false;
          const visibleMessages = expanded ? messages : messages.slice(0, 3);

          return (
            <Card key={participant.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-xl font-black text-slate-900">{participant.name}</h2>
                    <span className={`rounded-full border px-2 py-1 text-xs font-black ${statusTone[participant.status]}`}>
                      {participant.status}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-500">{participant.nickname}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingParticipant(participant)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"
                  aria-label="참석자 정보 수정"
                >
                  <Pencil size={17} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <InfoPill label="항공권" value={participant.flightBooked ? "예매" : "미예매"} active={participant.flightBooked} />
                <InfoPill label="숙소비" value={participant.accommodationPaid ? "입금" : "미입금"} active={participant.accommodationPaid} />
                <InfoPill label="여권" value={participant.passportChecked ? "확인" : "미확인"} active={participant.passportChecked} />
              </div>

              <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <p className="break-words">
                  <span className="font-bold text-slate-800">교통수단</span> · {participant.transport || "미정"}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  <span className="font-bold text-slate-800">개인 메모</span> · {participant.memo || "메모 없음"}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 break-words">
                    <span className="font-bold text-slate-800">계좌</span> · {participant.accountNumber || "미등록"}
                  </p>
                  {participant.accountNumber && (
                    <button
                      type="button"
                      onClick={() => copyAccount(participant.accountNumber)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-teal-600"
                      aria-label="계좌번호 복사"
                    >
                      <Copy size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <h3 className="font-black text-slate-900">공개 메시지</h3>
                <div className="flex shrink-0 gap-2">
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => deleteAllMessagesForParticipant(participant.id)}
                      className="h-10 rounded-lg bg-rose-50 px-3 text-xs font-black text-rose-600"
                      aria-label="멤버 메시지 전체 삭제"
                    >
                      전체 삭제
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openMessageModal(participant.id)}
                    className="flex h-10 items-center gap-2 rounded-lg bg-teal-500 px-3 text-sm font-black text-white"
                  >
                    <MessageSquarePlus size={17} />
                    메시지 남기기
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {visibleMessages.length ? (
                  visibleMessages.map((message) => {
                    const author = participantById.get(message.authorParticipantId);
                    return (
                      <article key={message.id} className="rounded-lg border border-slate-100 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-black text-slate-900">{author?.name ?? "알 수 없음"}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(message.createdAt)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteMessage(message.id)}
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-500"
                            aria-label="메시지 삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{message.content}</p>
                      </article>
                    );
                  })
                ) : (
                  <EmptyState icon="🍻" title="아직 남긴 말이 없어요" description="항공권 재촉부터 맛집 추천까지 편하게 남겨보세요." />
                )}
              </div>

              {messages.length > 3 && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedMessages((current) => ({
                      ...current,
                      [participant.id]: !expanded,
                    }))
                  }
                  className="mt-3 h-10 w-full rounded-lg bg-slate-100 text-sm font-black text-slate-700"
                >
                  {expanded ? "접기" : `전체 보기 (${messages.length}개)`}
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <Modal title="참석자 정보 수정" open={Boolean(editingParticipant)} onClose={() => setEditingParticipant(null)}>
        {editingParticipant && (
          <form onSubmit={saveParticipant} className="space-y-3">
            <TextField label="이름" value={editingParticipant.name} onChange={(value) => setEditingParticipant({ ...editingParticipant, name: value })} />
            <TextField label="별명" value={editingParticipant.nickname} onChange={(value) => setEditingParticipant({ ...editingParticipant, nickname: value })} />
            <label className="block">
              <span className="text-sm font-bold text-slate-700">참석 상태</span>
              <select
                value={editingParticipant.status}
                onChange={(event) =>
                  setEditingParticipant({ ...editingParticipant, status: event.target.value as AttendanceStatus })
                }
                className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <CheckField
              label="항공권 예매"
              checked={editingParticipant.flightBooked}
              onChange={(checked) => setEditingParticipant({ ...editingParticipant, flightBooked: checked })}
            />
            <CheckField
              label="숙소비 입금"
              checked={editingParticipant.accommodationPaid}
              onChange={(checked) => setEditingParticipant({ ...editingParticipant, accommodationPaid: checked })}
            />
            <CheckField
              label="여권 확인"
              checked={editingParticipant.passportChecked}
              onChange={(checked) => setEditingParticipant({ ...editingParticipant, passportChecked: checked })}
            />
            <TextField label="교통수단" value={editingParticipant.transport} onChange={(value) => setEditingParticipant({ ...editingParticipant, transport: value })} />
            <TextField label="계좌번호" value={editingParticipant.accountNumber} onChange={(value) => setEditingParticipant({ ...editingParticipant, accountNumber: value })} />
            <label className="block">
              <span className="text-sm font-bold text-slate-700">개인 메모</span>
              <textarea
                value={editingParticipant.memo}
                onChange={(event) => setEditingParticipant({ ...editingParticipant, memo: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 p-3"
              />
            </label>
            <button type="submit" className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
              저장
            </button>
          </form>
        )}
      </Modal>

      <Modal title="한마디 남기기" open={Boolean(messageTargetId)} onClose={() => setMessageTargetId(null)}>
        <form onSubmit={saveMessage} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">작성자</span>
            <select
              value={messageForm.authorParticipantId}
              onChange={(event) => setMessageForm((current) => ({ ...current, authorParticipantId: event.target.value }))}
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
            <span className="text-sm font-bold text-slate-700">메시지</span>
            <textarea
              value={messageForm.content}
              onChange={(event) => setMessageForm((current) => ({ ...current, content: event.target.value }))}
              placeholder="비행기표 빨리 끊어라 ㅋㅋ"
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 p-3"
            />
          </label>
          <button type="submit" className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            등록
          </button>
        </form>
      </Modal>
    </div>
  );
}

function InfoPill({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-lg p-2 text-center ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      <p className="text-[11px] font-bold">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
      />
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between rounded-lg border border-slate-200 px-3">
      <span className="font-bold text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-teal-500"
      />
    </label>
  );
}
