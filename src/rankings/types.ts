import type { BiggestWin, HeadToHead, LineupPlayer, PlayoffLine } from "../facts/types";
import type { RankedTeam } from "./score";

export type RankingsTeamFact = Omit<RankedTeam, "powerScore"> & {
  note: string | null;
  benchPoints?: number | null;
  faabBalance?: number | null;
  waiverPriority?: number | null;
  moves?: number | null;
  trades?: number | null;
  longestStreak?: string;
  biggestWin?: BiggestWin | null;
  headToHead?: HeadToHead[];
  remainingOpponentNames?: Array<{ name: string; pointsPerGame: number | null }>;
  playoff?: PlayoffLine | null;
  lineup?: LineupPlayer[];
  rankByWeek?: Array<{ week: number; rank: number }>;
};

export type RankingsBrief = {
  leagueKey: string;
  leagueName: string;
  week: number;
  teams: RankingsTeamFact[];
  scoringType?: string | null;
  rosterSlots?: string[];
};

export type RankingsEntry = {
  teamKey: string;
  paragraphs: string[];
};

export type RankingsBody = {
  lede: string;
  entries: RankingsEntry[];
  kicker: string | null;
};

export type RankingsDraft = RankingsBody & {
  headline: string;
  dek: string;
};
