import { Camera, ChevronRight, Settings, UserRoundCheck, Vote } from "lucide-react";
import Card from "../../components/Card";
import type { MoreView } from "../../types";

interface MorePageProps {
  onOpen: (view: MoreView) => void;
}

const items = [
  {
    view: "participants",
    title: "참석자",
    description: "8명 상태와 멤버별 메시지 보드",
    Icon: UserRoundCheck,
    tone: "bg-teal-50 text-teal-700",
  },
  {
    view: "vote",
    title: "후보 투표",
    description: "숙소, 라멘, 이자카야, 액티비티 후보",
    Icon: Vote,
    tone: "bg-sky-50 text-sky-700",
  },
  {
    view: "memories",
    title: "사진/추억",
    description: "2016년부터 2026년까지 기록",
    Icon: Camera,
    tone: "bg-rose-50 text-rose-700",
  },
  {
    view: "settings",
    title: "설정",
    description: "여행 제목, 날짜, 환율, 데이터 초기화",
    Icon: Settings,
    tone: "bg-emerald-50 text-emerald-700",
  },
] as const;

export default function MorePage({ onOpen }: MorePageProps) {
  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm font-bold text-teal-600">더보기</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">여행 허브 메뉴</h1>
      </header>

      <div className="space-y-3">
        {items.map(({ view, title, description, Icon, tone }) => (
          <button key={view} type="button" onClick={() => onOpen(view)} className="w-full text-left">
            <Card className="transition active:scale-[0.99]">
              <div className="flex items-center gap-3">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ${tone}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-slate-900">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
                <ChevronRight className="text-slate-400" size={20} />
              </div>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}
