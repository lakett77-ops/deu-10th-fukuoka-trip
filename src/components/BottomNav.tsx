import { CalendarDays, CheckSquare, Home, Menu, WalletCards } from "lucide-react";
import type { MainTab } from "../types";

interface BottomNavProps {
  activeTab: MainTab;
  onChange: (tab: MainTab) => void;
}

const navItems = [
  { tab: "home", label: "홈", Icon: Home },
  { tab: "schedule", label: "일정", Icon: CalendarDays },
  { tab: "settlement", label: "정산", Icon: WalletCards },
  { tab: "checklist", label: "준비물", Icon: CheckSquare },
  { tab: "more", label: "더보기", Icon: Menu },
] as const;

export default function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.map(({ tab, label, Icon }) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-xs font-semibold transition ${
                active ? "bg-teal-500 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
