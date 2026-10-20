import { BreakingBanner } from "@/components/home/BreakingBanner";
import { HeroLead } from "@/components/home/HeroLead";
import { LatestFeed } from "@/components/home/LatestFeed";
import { ManagerMic } from "@/components/home/ManagerMic";
import { PowerRankingsStrip } from "@/components/home/PowerRankingsStrip";
import { ScoreTicker } from "@/components/home/ScoreTicker";
import { StandingsMini } from "@/components/home/StandingsMini";
import { TrendingList } from "@/components/home/TrendingList";
import { WeeklyRecapRail } from "@/components/home/WeeklyRecapRail";
import { pageWidth } from "@/lib/labels";

export default function HomePage() {
  return (
    <main>
      <ScoreTicker />
      <BreakingBanner />
      <div className={`${pageWidth} flex flex-col gap-10 py-6`}>
        <HeroLead />
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <LatestFeed />
          <aside className="flex flex-col gap-8">
            <TrendingList />
            <StandingsMini />
            <ManagerMic />
          </aside>
        </div>
        <WeeklyRecapRail />
        <PowerRankingsStrip />
      </div>
    </main>
  );
}
