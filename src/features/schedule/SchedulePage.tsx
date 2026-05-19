import { Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";
import { Clock, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import type { ScheduleCategory, ScheduleItem, TravelAppData } from "../../types";
import { formatKoreanDate } from "../../utils/date";
import { createId } from "../../utils/id";

interface SchedulePageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
}

const categories: ScheduleCategory[] = ["이동", "식사", "관광", "자유시간", "숙소", "술자리", "기타"];
const categoryTone: Record<ScheduleCategory, string> = {
  이동: "bg-sky-100 text-sky-700",
  식사: "bg-orange-100 text-orange-700",
  관광: "bg-emerald-100 text-emerald-700",
  자유시간: "bg-violet-100 text-violet-700",
  숙소: "bg-teal-100 text-teal-700",
  술자리: "bg-rose-100 text-rose-700",
  기타: "bg-slate-100 text-slate-600",
};

const emptyForm = (date: string): Omit<ScheduleItem, "id"> => ({
  date,
  time: "12:00",
  title: "",
  place: "",
  travelTime: "",
  memo: "",
  category: "관광",
});

export default function SchedulePage({ data, setData }: SchedulePageProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<ScheduleItem, "id">>(() => emptyForm(data.settings.startDate));

  const groupedSchedules = useMemo(() => {
    const sorted = data.schedules
      .slice()
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
    return sorted.reduce<Record<string, ScheduleItem[]>>((groups, item) => {
      groups[item.date] = [...(groups[item.date] ?? []), item];
      return groups;
    }, {});
  }, [data.schedules]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(data.settings.startDate));
    setModalOpen(true);
  };

  const openEdit = (item: ScheduleItem) => {
    setEditingId(item.id);
    setForm({
      date: item.date,
      time: item.time,
      title: item.title,
      place: item.place,
      travelTime: item.travelTime,
      memo: item.memo,
      category: item.category,
    });
    setModalOpen(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    setData((current) => ({
      ...current,
      schedules: editingId
        ? current.schedules.map((item) => (item.id === editingId ? { ...form, id: editingId } : item))
        : [...current.schedules, { ...form, id: createId("schedule") }],
    }));
    setModalOpen(false);
  };

  const deleteSchedule = (id: string) => {
    if (!confirm("이 일정을 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      schedules: current.schedules.filter((item) => item.id !== id),
    }));
  };

  const deleteAllSchedules = () => {
    if (!confirm("일정 항목을 전체 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      schedules: [],
    }));
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-teal-600">일정표</p>
          <h1 className="mt-1 text-2xl font-black text-slate-900">후쿠오카 타임라인 🏮</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={deleteAllSchedules}
            className="grid h-12 w-12 place-items-center rounded-lg bg-white text-rose-600 shadow-sm"
            aria-label="일정 전체 삭제"
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

      {Object.keys(groupedSchedules).length ? (
        <div className="space-y-5">
          {Object.entries(groupedSchedules).map(([date, items]) => (
            <section key={date} className="space-y-3">
              <div className="sticky top-0 z-10 rounded-lg bg-teal-500 px-4 py-2 text-sm font-black text-white shadow-sm">
                {formatKoreanDate(date)}
              </div>
              <div className="relative space-y-3 pl-4 before:absolute before:bottom-2 before:left-1 before:top-2 before:w-0.5 before:bg-teal-100">
                {items.map((item) => (
                  <Card key={item.id} className="relative">
                    <span className="absolute -left-[1.18rem] top-6 h-3 w-3 rounded-full border-2 border-white bg-teal-500" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-black ${categoryTone[item.category]}`}>
                            {item.category}
                          </span>
                          <span className="text-sm font-black text-slate-500">{item.time}</span>
                        </div>
                        <h2 className="mt-2 break-words text-lg font-black text-slate-900">{item.title}</h2>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-600"
                          aria-label="일정 수정"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSchedule(item.id)}
                          className="grid h-10 w-10 place-items-center rounded-lg bg-rose-50 text-rose-600"
                          aria-label="일정 삭제"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                      <p className="flex gap-2">
                        <MapPin className="mt-0.5 shrink-0 text-sky-500" size={16} />
                        <span className="break-words">{item.place || "장소 미정"}</span>
                      </p>
                      <p className="flex gap-2">
                        <Clock className="mt-0.5 shrink-0 text-emerald-500" size={16} />
                        <span className="break-words">{item.travelTime || "이동 시간 미정"}</span>
                      </p>
                      {item.memo && <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3">{item.memo}</p>}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon="✈️" title="아직 일정이 없어요" description="공항 집합부터 하나씩 넣어보세요." />
      )}

      <Modal title={editingId ? "일정 수정" : "일정 추가"} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">날짜</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">시간</span>
            <input
              type="time"
              value={form.time}
              onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">제목</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="예: 나카스 이자카야"
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">장소</span>
            <input
              value={form.place}
              onChange={(event) => setForm((current) => ({ ...current, place: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">이동 시간</span>
            <input
              value={form.travelTime}
              onChange={(event) => setForm((current) => ({ ...current, travelTime: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">카테고리</span>
            <select
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ScheduleCategory }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
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
    </div>
  );
}
