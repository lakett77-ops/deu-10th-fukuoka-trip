import { Dispatch, SetStateAction, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import { defaultData } from "../../data/defaultData";
import type {
  AttendanceStatus,
  ChecklistKind,
  ChecklistItem,
  ScheduleCategory,
  ScheduleItem,
  TravelAppData,
} from "../../types";
import { calculateDday, formatDateRange, formatKoreanDate } from "../../utils/date";
import { createId } from "../../utils/id";

interface HomePageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
}

type HomeEditor = "trip" | "participants" | "todos" | "announcement" | "schedule" | "vibe" | null;

const statusOrder: AttendanceStatus[] = ["확정", "미정", "불참", "중간 합류", "중간 이탈"];
const checklistKinds: ChecklistKind[] = ["개인", "공용"];
const scheduleCategories: ScheduleCategory[] = ["이동", "식사", "관광", "자유시간", "숙소", "술자리", "기타"];

const statusColor: Record<AttendanceStatus, string> = {
  확정: "bg-emerald-100 text-emerald-700",
  미정: "bg-amber-100 text-amber-700",
  불참: "bg-slate-100 text-slate-600",
  "중간 합류": "bg-sky-100 text-sky-700",
  "중간 이탈": "bg-rose-100 text-rose-700",
};

const defaultHomeEmojis = ["✈️", "🍜", "🍻", "🏮", "🌊"];

export default function HomePage({ data, setData }: HomePageProps) {
  const { settings, participants, checklists, schedules } = data;
  const [editor, setEditor] = useState<HomeEditor>(null);
  const [newTodoName, setNewTodoName] = useState("");
  const [emojiDraft, setEmojiDraft] = useState(() => (settings.homeEmojis?.length ? settings.homeEmojis : defaultHomeEmojis).join(" "));

  const dday = calculateDday(settings.startDate, settings.endDate);
  const homeEmojis = settings.homeEmojis?.length ? settings.homeEmojis : defaultHomeEmojis;
  const statusCounts = statusOrder.map((status) => ({
    status,
    count: participants.filter((participant) => participant.status === status).length,
  }));
  const todos = checklists.filter((item) => !item.done).slice(0, 3);
  const nextSchedule = schedules
    .slice()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];

  const updateSettings = (patch: Partial<TravelAppData["settings"]>) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  };

  const resetHome = () => {
    if (!confirm("홈 섹션을 하드 리셋할까요? 여행 제목, 날짜, 공지사항, 홈 아이콘이 예시 기본값으로 돌아갑니다.")) return;
    setData((current) => ({
      ...current,
      settings: structuredClone(defaultData.settings),
    }));
    setEmojiDraft(defaultData.settings.homeEmojis.join(" "));
  };

  const updateParticipant = (participantId: string, patch: Partial<TravelAppData["participants"][number]>) => {
    setData((current) => ({
      ...current,
      participants: current.participants.map((participant) =>
        participant.id === participantId ? { ...participant, ...patch } : participant,
      ),
    }));
  };

  const updateChecklist = (itemId: string, patch: Partial<ChecklistItem>) => {
    setData((current) => ({
      ...current,
      checklists: current.checklists.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  };

  const addChecklist = () => {
    const name = newTodoName.trim();
    if (!name) return;

    setData((current) => ({
      ...current,
      checklists: [
        ...current.checklists,
        {
          id: createId("home-checklist"),
          name,
          kind: "개인",
          ownerId: current.participants[0]?.id ?? "",
          done: false,
          memo: "",
        },
      ],
    }));
    setNewTodoName("");
  };

  const deleteChecklist = (itemId: string) => {
    if (!confirm("이 준비 항목을 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      checklists: current.checklists.filter((item) => item.id !== itemId),
    }));
  };

  const deleteAllChecklistItems = () => {
    if (!confirm("준비 항목을 전체 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      checklists: [],
    }));
  };

  const updateSchedule = (scheduleId: string, patch: Partial<ScheduleItem>) => {
    setData((current) => ({
      ...current,
      schedules: current.schedules.map((schedule) => (schedule.id === scheduleId ? { ...schedule, ...patch } : schedule)),
    }));
  };

  const addFirstSchedule = () => {
    setData((current) => ({
      ...current,
      schedules: [
        {
          id: createId("home-schedule"),
          date: current.settings.startDate,
          time: "12:00",
          title: "새 일정",
          place: "후쿠오카",
          travelTime: "미정",
          memo: "",
          category: "기타",
        },
        ...current.schedules,
      ],
    }));
  };

  const saveHomeEmojis = () => {
    const nextEmojis = emojiDraft
      .split(/[\s,]+/)
      .map((emoji) => emoji.trim())
      .filter(Boolean)
      .slice(0, 8);
    updateSettings({ homeEmojis: nextEmojis.length ? nextEmojis : defaultHomeEmojis });
    setEditor(null);
  };

  return (
    <div className="space-y-4">
      <header className="rounded-lg bg-gradient-to-br from-teal-500 via-sky-500 to-rose-400 p-5 text-white shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/85">{settings.appName}</p>
            <h1 className="mt-2 break-words text-3xl font-black leading-tight tracking-normal">{settings.title}</h1>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={resetHome}
              className="grid h-11 w-11 place-items-center rounded-lg bg-white/20 text-white"
              aria-label="홈 섹션 하드 리셋"
            >
              <RotateCcw size={18} />
            </button>
            <button
              type="button"
              onClick={() => setEditor("trip")}
              className="grid h-11 w-11 place-items-center rounded-lg bg-white/20 text-white"
              aria-label="여행 기본 정보 수정"
            >
              <Pencil size={18} />
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/20 p-3">
            <div className="flex items-center gap-2 text-sm text-white/85">
              <MapPin size={16} />
              여행지
            </div>
            <p className="mt-1 break-words text-xl font-extrabold">{settings.destination}</p>
          </div>
          <div className="rounded-lg bg-white/20 p-3">
            <div className="flex items-center gap-2 text-sm text-white/85">
              <Plane size={16} />
              남은 시간
            </div>
            <p className="mt-1 text-xl font-extrabold">{dday}</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-white/90">{formatDateRange(settings.startDate, settings.endDate)}</p>
      </header>

      <Card>
        <SectionTitle icon={<Users className="text-teal-600" size={19} />} title="참석자 현황" onEdit={() => setEditor("participants")} />
        <div className="mt-3 grid grid-cols-5 gap-2">
          {statusCounts.map(({ status, count }) => (
            <div key={status} className={`rounded-lg px-2 py-3 text-center ${statusColor[status]}`}>
              <p className="text-lg font-black">{count}</p>
              <p className="mt-1 text-[11px] font-bold leading-tight">{status}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle
          icon={<CheckCircle2 className="text-emerald-600" size={19} />}
          title="오늘 볼 준비 항목"
          onEdit={() => setEditor("todos")}
        />
        {todos.length ? (
          <div className="mt-3 space-y-2">
            {todos.map((todo) => (
              <button
                key={todo.id}
                type="button"
                onClick={() => updateChecklist(todo.id, { done: true })}
                className="flex w-full items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="break-words font-bold text-slate-900">{todo.name}</p>
                  <p className="break-words text-xs text-slate-500">
                    {todo.kind} 준비물 · {todo.memo || "메모 없음"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold text-emerald-700">완료 체크</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState icon="🌊" title="준비물 체크 완료" description="모모치해변 갈 준비까지 끝난 느낌입니다." />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={<Bell className="text-rose-500" size={19} />} title="공지사항" onEdit={() => setEditor("announcement")} />
        <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-3 text-sm leading-6 text-slate-700">
          {settings.announcement || "공지사항을 입력해보세요."}
        </p>
      </Card>

      <Card>
        <SectionTitle
          icon={<CalendarDays className="text-sky-600" size={19} />}
          title="다음 일정 미리보기"
          onEdit={() => setEditor("schedule")}
        />
        {nextSchedule ? (
          <div className="mt-3 rounded-lg bg-sky-50 p-3">
            <p className="text-xs font-bold text-sky-700">
              {formatKoreanDate(nextSchedule.date)} · {nextSchedule.time}
            </p>
            <p className="mt-1 break-words text-lg font-black text-slate-900">{nextSchedule.title}</p>
            <p className="mt-1 break-words text-sm text-slate-600">
              {nextSchedule.place} · {nextSchedule.travelTime}
            </p>
            {nextSchedule.memo && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-500">{nextSchedule.memo}</p>}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState icon="🏮" title="일정이 비어 있어요" description="텐진부터 나카스까지 하나씩 채워보세요." />
          </div>
        )}
      </Card>

      <button
        type="button"
        onClick={() => {
          setEmojiDraft(homeEmojis.join(" "));
          setEditor("vibe");
        }}
        className="grid w-full grid-cols-5 gap-2 text-center text-2xl"
        aria-label="홈 분위기 아이콘 수정"
      >
        {homeEmojis.slice(0, 5).map((emoji, index) => (
          <div key={`${emoji}-${index}`} className="rounded-lg bg-white/80 py-3 shadow-sm">
            {emoji}
          </div>
        ))}
      </button>

      <Modal title="여행 기본 정보 수정" open={editor === "trip"} onClose={() => setEditor(null)}>
        <div className="space-y-3">
          <TextField label="앱 이름" value={settings.appName} onChange={(value) => updateSettings({ appName: value })} />
          <TextField label="여행 제목" value={settings.title} onChange={(value) => updateSettings({ title: value })} />
          <TextField label="여행지" value={settings.destination} onChange={(value) => updateSettings({ destination: value })} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="시작일" type="date" value={settings.startDate} onChange={(value) => updateSettings({ startDate: value })} />
            <TextField label="종료일" type="date" value={settings.endDate} onChange={(value) => updateSettings({ endDate: value })} />
          </div>
          <button type="button" onClick={() => setEditor(null)} className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            완료
          </button>
        </div>
      </Modal>

      <Modal title="참석자 현황 수정" open={editor === "participants"} onClose={() => setEditor(null)}>
        <div className="space-y-3">
          {participants.map((participant) => (
            <div key={participant.id} className="rounded-lg border border-slate-100 p-3">
              <p className="mb-2 break-words font-black text-slate-900">{participant.name}</p>
              <select
                value={participant.status}
                onChange={(event) => updateParticipant(participant.id, { status: event.target.value as AttendanceStatus })}
                className="h-12 w-full rounded-lg border border-slate-200 px-3"
              >
                {statusOrder.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-bold text-slate-600">
                <CheckToggle
                  label="항공권"
                  checked={participant.flightBooked}
                  onChange={(checked) => updateParticipant(participant.id, { flightBooked: checked })}
                />
                <CheckToggle
                  label="숙소비"
                  checked={participant.accommodationPaid}
                  onChange={(checked) => updateParticipant(participant.id, { accommodationPaid: checked })}
                />
                <CheckToggle
                  label="여권"
                  checked={participant.passportChecked}
                  onChange={(checked) => updateParticipant(participant.id, { passportChecked: checked })}
                />
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <Modal title="준비 항목 수정" open={editor === "todos"} onClose={() => setEditor(null)}>
        <div className="space-y-3">
          {checklists.length > 0 && (
            <button
              type="button"
              onClick={deleteAllChecklistItems}
              className="h-11 w-full rounded-lg bg-rose-50 text-sm font-black text-rose-600"
            >
              준비 항목 전체 삭제
            </button>
          )}
          <div className="flex gap-2">
            <input
              value={newTodoName}
              onChange={(event) => setNewTodoName(event.target.value)}
              placeholder="새 준비물"
              className="h-12 min-w-0 flex-1 rounded-lg border border-slate-200 px-3"
            />
            <button type="button" onClick={addChecklist} className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-teal-500 text-white">
              <Plus size={20} />
            </button>
          </div>
          {checklists.map((item) => (
            <div key={item.id} className="space-y-2 rounded-lg border border-slate-100 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(event) => updateChecklist(item.id, { done: event.target.checked })}
                  className="h-5 w-5 accent-teal-500"
                />
                <input
                  value={item.name}
                  onChange={(event) => updateChecklist(item.id, { name: event.target.value })}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 font-bold"
                />
                <button
                  type="button"
                  onClick={() => deleteChecklist(item.id)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"
                  aria-label="준비 항목 삭제"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={item.kind}
                  onChange={(event) => updateChecklist(item.id, { kind: event.target.value as ChecklistKind })}
                  className="h-11 rounded-lg border border-slate-200 px-3"
                >
                  {checklistKinds.map((kind) => (
                    <option key={kind}>{kind}</option>
                  ))}
                </select>
                <select
                  value={item.ownerId}
                  onChange={(event) => updateChecklist(item.id, { ownerId: event.target.value })}
                  className="h-11 rounded-lg border border-slate-200 px-3"
                >
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={item.memo}
                onChange={(event) => updateChecklist(item.id, { memo: event.target.value })}
                rows={2}
                placeholder="메모"
                className="w-full rounded-lg border border-slate-200 p-3"
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal title="공지사항 수정" open={editor === "announcement"} onClose={() => setEditor(null)}>
        <div className="space-y-3">
          <textarea
            value={settings.announcement}
            onChange={(event) => updateSettings({ announcement: event.target.value })}
            rows={6}
            className="w-full rounded-lg border border-slate-200 p-3"
          />
          <button type="button" onClick={() => setEditor(null)} className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            완료
          </button>
        </div>
      </Modal>

      <Modal title="다음 일정 수정" open={editor === "schedule"} onClose={() => setEditor(null)}>
        {nextSchedule ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <TextField label="날짜" type="date" value={nextSchedule.date} onChange={(value) => updateSchedule(nextSchedule.id, { date: value })} />
              <TextField label="시간" type="time" value={nextSchedule.time} onChange={(value) => updateSchedule(nextSchedule.id, { time: value })} />
            </div>
            <TextField label="제목" value={nextSchedule.title} onChange={(value) => updateSchedule(nextSchedule.id, { title: value })} />
            <TextField label="장소" value={nextSchedule.place} onChange={(value) => updateSchedule(nextSchedule.id, { place: value })} />
            <TextField label="이동 시간" value={nextSchedule.travelTime} onChange={(value) => updateSchedule(nextSchedule.id, { travelTime: value })} />
            <label className="block">
              <span className="text-sm font-bold text-slate-700">카테고리</span>
              <select
                value={nextSchedule.category}
                onChange={(event) => updateSchedule(nextSchedule.id, { category: event.target.value as ScheduleCategory })}
                className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
              >
                {scheduleCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">메모</span>
              <textarea
                value={nextSchedule.memo}
                onChange={(event) => updateSchedule(nextSchedule.id, { memo: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 p-3"
              />
            </label>
            <button type="button" onClick={() => setEditor(null)} className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
              완료
            </button>
          </div>
        ) : (
          <button type="button" onClick={addFirstSchedule} className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            첫 일정 만들기
          </button>
        )}
      </Modal>

      <Modal title="홈 분위기 아이콘 수정" open={editor === "vibe"} onClose={() => setEditor(null)}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">이모지</span>
            <input
              value={emojiDraft}
              onChange={(event) => setEmojiDraft(event.target.value)}
              placeholder="✈️ 🍜 🍻 🏮 🌊"
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <p className="text-sm text-slate-500">공백이나 쉼표로 구분하면 홈 하단 아이콘으로 저장됩니다.</p>
          <button type="button" onClick={saveHomeEmojis} className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            저장
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SectionTitle({ icon, title, onEdit }: { icon: React.ReactNode; title: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h2 className="break-words font-bold text-slate-900">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"
        aria-label={`${title} 수정`}
      >
        <Pencil size={17} />
      </button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
      />
    </label>
  );
}

function CheckToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`rounded-lg p-2 text-center ${checked ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className="block">{label}</span>
      <span className="mt-1 block text-[11px]">{checked ? "완료" : "아직"}</span>
    </label>
  );
}
