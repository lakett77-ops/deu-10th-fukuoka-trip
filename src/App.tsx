import { useEffect, useState } from "react";
import Layout from "./components/Layout";
import HomePage from "./features/home/HomePage";
import SchedulePage from "./features/schedule/SchedulePage";
import SettlementPage from "./features/settlement/SettlementPage";
import ChecklistPage from "./features/checklist/ChecklistPage";
import ParticipantsPage from "./features/participants/ParticipantsPage";
import VotePage from "./features/vote/VotePage";
import MemoriesPage from "./features/memories/MemoriesPage";
import FurDodgeGamePage from "./features/game/FurDodgeGamePage";
import SettingsPage from "./features/settings/SettingsPage";
import MorePage from "./features/settings/MorePage";
import type { MainTab, MoreView } from "./types";
import { saveTripData } from "./utils/storage";
import { useSharedTripData } from "./hooks/useSharedTripData";

export default function App() {
  const { data, setData } = useSharedTripData();
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [moreView, setMoreView] = useState<MoreView>("menu");

  useEffect(() => {
    try {
      saveTripData(data);
    } catch (error) {
      console.warn("Local trip save failed:", error);
    }
  }, [data]);

  const handleTabChange = (tab: MainTab) => {
    setActiveTab(tab);
    if (tab === "more") {
      setMoreView("menu");
    }
  };

  const renderMoreView = () => {
    if (moreView === "participants") {
      return <ParticipantsPage data={data} setData={setData} onBack={() => setMoreView("menu")} />;
    }
    if (moreView === "vote") {
      return <VotePage data={data} setData={setData} onBack={() => setMoreView("menu")} />;
    }
    if (moreView === "memories") {
      return <MemoriesPage data={data} setData={setData} onBack={() => setMoreView("menu")} />;
    }
    if (moreView === "game") {
      return <FurDodgeGamePage data={data} setData={setData} onBack={() => setMoreView("menu")} />;
    }
    if (moreView === "settings") {
      return <SettingsPage data={data} setData={setData} onBack={() => setMoreView("menu")} />;
    }

    return <MorePage onOpen={setMoreView} />;
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {activeTab === "home" && <HomePage data={data} setData={setData} />}
      {activeTab === "schedule" && <SchedulePage data={data} setData={setData} />}
      {activeTab === "settlement" && <SettlementPage data={data} setData={setData} />}
      {activeTab === "checklist" && <ChecklistPage data={data} setData={setData} />}
      {activeTab === "more" && renderMoreView()}
    </Layout>
  );
}
