import type { PropsWithChildren } from "react";
import BottomNav from "./BottomNav";
import type { MainTab } from "../types";

interface LayoutProps extends PropsWithChildren {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  return (
    <div className="mx-auto min-h-screen max-w-md overflow-hidden bg-white/45 shadow-[0_0_40px_rgba(15,23,42,0.08)]">
      <main className="app-scrollbar min-h-screen overflow-y-auto px-4 pb-28 pt-4">{children}</main>
      <BottomNav activeTab={activeTab} onChange={onTabChange} />
    </div>
  );
}
