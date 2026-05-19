import { Dispatch, SetStateAction } from "react";
import { ArrowLeft, Copy, RotateCcw, Share2, Trash2 } from "lucide-react";
import Card from "../../components/Card";
import type { AttendanceStatus, TravelAppData } from "../../types";
import { getShareUrl } from "../../utils/collaboration";
import { clearTripData, restoreDefaultTripData } from "../../utils/storage";

interface SettingsPageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
  onBack: () => void;
}

const blankStatuses: AttendanceStatus = "미정";

export default function SettingsPage({ data, setData, onBack }: SettingsPageProps) {
  const shareUrl = getShareUrl();

  const updateSettings = (patch: Partial<TravelAppData["settings"]>) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  };

  const updateParticipant = (participantId: string, patch: Partial<TravelAppData["participants"][number]>) => {
    setData((current) => ({
      ...current,
      participants: current.participants.map((participant) =>
        participant.id === participantId ? { ...participant, ...patch } : participant,
      ),
    }));
  };

  const resetData = () => {
    if (!confirm("localStorage에 저장된 여행 데이터를 초기화할까요? 이 작업은 되돌릴 수 없어요.")) return;
    const blankData: TravelAppData = {
      settings: {
        ...data.settings,
        announcement: "",
      },
      participants: data.participants.map((participant) => ({
        ...participant,
        nickname: "",
        status: blankStatuses,
        flightBooked: false,
        accommodationPaid: false,
        passportChecked: false,
        transport: "",
        memo: "",
        bankName: "",
        accountNumber: "",
      })),
      participantMessages: [],
      schedules: [],
      expenses: [],
      preflightChecks: [],
      checklists: [],
      votes: [],
      memories: [],
      memberCards: [],
      photoLinks: [],
      photoLibrary: [],
    };
    clearTripData();
    setData(blankData);
  };

  const resetSettingsSection = () => {
    if (!confirm("설정 섹션을 하드 리셋할까요? 여행 기본 정보와 기본 참석자 이름/별명/계좌가 예시 기본값으로 돌아갑니다.")) return;
    const defaults = restoreDefaultTripData();
    setData((current) => ({
      ...current,
      settings: defaults.settings,
      participants: current.participants.map((participant, index) => {
        const defaultParticipant = defaults.participants[index];
        if (!defaultParticipant) return participant;

        return {
          ...participant,
          name: defaultParticipant.name,
          nickname: defaultParticipant.nickname,
          bankName: defaultParticipant.bankName,
          accountNumber: defaultParticipant.accountNumber,
        };
      }),
    }));
  };

  const restoreExamples = () => {
    if (!confirm("예시 데이터로 복원할까요? 현재 저장된 내용은 덮어써집니다.")) return;
    setData(restoreDefaultTripData());
  };

  const shareLink = async () => {
    if (!shareUrl) return;

    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: data.settings.title,
          text: "후쿠오카 여행 준비 앱 링크야. 여기서 같이 수정하면 돼.",
          url: shareUrl,
        });
        return;
      } catch {
        // 사용자가 공유를 취소하면 아래 복사 흐름으로 넘깁니다.
      }
    }

    await navigator.clipboard?.writeText(shareUrl);
    alert("공유 링크를 복사했어요. 이 링크를 카카오톡에 보내면 돼요.");
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-lg bg-white shadow-sm" aria-label="뒤로">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-sm font-bold text-teal-600">설정</p>
          <h1 className="text-2xl font-black text-slate-900">여행 기본 정보</h1>
        </div>
      </header>

      <Card className="space-y-3 border-teal-100 bg-teal-50/80">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-teal-700">공유 링크</p>
            <h2 className="mt-1 text-lg font-black text-slate-900">카카오톡으로 바로 보내기</h2>
          </div>
          <button
            type="button"
            onClick={shareLink}
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-teal-500 px-3 font-black text-white"
          >
            <Share2 size={16} />
            공유
          </button>
        </div>
        <p className="break-all rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-600">{shareUrl}</p>
        <p className="text-xs font-bold text-slate-500">같은 링크를 열면 여러 친구가 같은 여행 데이터를 같이 수정할 수 있어요.</p>
      </Card>

      <Card className="space-y-3">
        <TextField label="앱 이름" value={data.settings.appName} onChange={(value) => updateSettings({ appName: value })} />
        <TextField label="여행 제목" value={data.settings.title} onChange={(value) => updateSettings({ title: value })} />
        <TextField label="여행지" value={data.settings.destination} onChange={(value) => updateSettings({ destination: value })} />
        <div className="grid grid-cols-2 gap-2">
          <TextField label="시작일" type="date" value={data.settings.startDate} onChange={(value) => updateSettings({ startDate: value })} />
          <TextField label="종료일" type="date" value={data.settings.endDate} onChange={(value) => updateSettings({ endDate: value })} />
        </div>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">환율</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={data.settings.exchangeRate}
            onChange={(event) => updateSettings({ exchangeRate: Number(event.target.value) })}
            className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">공지사항</span>
          <textarea
            value={data.settings.announcement}
            onChange={(event) => updateSettings({ announcement: event.target.value })}
            rows={4}
            className="mt-1 w-full rounded-lg border border-slate-200 p-3"
          />
        </label>
      </Card>

      <section className="space-y-3">
        <h2 className="px-1 text-lg font-black text-slate-900">기본 참석자 정보</h2>
        {data.participants.map((participant) => (
          <Card key={participant.id} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <TextField label="이름" value={participant.name} onChange={(value) => updateParticipant(participant.id, { name: value })} />
              <TextField label="별명" value={participant.nickname} onChange={(value) => updateParticipant(participant.id, { nickname: value })} />
            </div>
            <TextField label="계좌번호" value={participant.accountNumber} onChange={(value) => updateParticipant(participant.id, { accountNumber: value })} />
          </Card>
        ))}
      </section>

      <Card className="space-y-3">
        <button
          type="button"
          onClick={resetSettingsSection}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white font-black text-rose-600 shadow-sm"
        >
          <RotateCcw size={18} />
          설정 섹션 하드 리셋
        </button>
        <button
          type="button"
          onClick={restoreExamples}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 font-black text-white"
        >
          <RotateCcw size={18} />
          예시 데이터 복원
        </button>
        <button
          type="button"
          onClick={resetData}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-500 font-black text-white"
        >
          <Trash2 size={18} />
          localStorage 데이터 초기화
        </button>
      </Card>
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
