import type { BiggestWin, HeadToHead, LineupPlayer, PlayoffLine } from "../facts/types";

export type RecapRecord = {
  wins: number;
  losses: number;
  ties: number;
};

export type BriefPerformer = {
  name: string;
  position: string | null;
  points: number;
  selectedPosition: string | null;
};

export type BriefSide = {
  teamKey: string;
  teamName: string;
  managerName: string | null;
  points: number;
  projectedPoints: number | null;
  projectionDelta: number | null;
  record: RecapRecord;
  rankBefore: number;
  rankAfter: number;
  streak: string;
  pointsFor: number;
  pointsAgainst: number;
  topPerformers: BriefPerformer[];
  lineup?: LineupPlayer[];
  benchPoints?: number | null;
  faabBalance?: number | null;
  waiverPriority?: number | null;
  moves?: number | null;
  trades?: number | null;
  longestStreak?: string;
  biggestWin?: BiggestWin | null;
  headToHead?: HeadToHead[];
  remainingOpponents?: Array<{ name: string; pointsPerGame: number | null }>;
  playoff?: PlayoffLine | null;
  rankByWeek?: Array<{ week: number; rank: number }>;
};

export type BriefMatchup = {
  matchupKey: string;
  result: "win" | "tie";
  margin: number;
  winner: BriefSide;
  loser: BriefSide;
  leads?: string[];
};

export type BriefTransactionPlayer = {
  name: string | null;
  action: string | null;
  sourceTeamName: string | null;
  destinationTeamName: string | null;
};

export type BriefTransaction = {
  type: string | null;
  status: string | null;
  timestamp: string;
  faabBid: number | null;
  players: BriefTransactionPlayer[];
};

export type WeekBrief = {
  leagueKey: string;
  leagueName: string;
  week: number;
  weekStart: string | null;
  weekEnd: string | null;
  matchups: BriefMatchup[];
  transactions: BriefTransaction[];
  scoringType?: string | null;
  rosterSlots?: string[];
};

export type RecapSection = {
  matchupKey: string;
  heading: string;
  paragraphs: string[];
};

export type RecapBody = {
  lede: string;
  sections: RecapSection[];
  kicker: string | null;
};

export type RecapCardDraft = {
  matchupKey: string;
  headline: string;
  dek: string;
};

export type RecapDraft = {
  column: {
    headline: string;
    dek: string;
    lede: string;
    sections: RecapSection[];
    kicker: string | null;
  };
  cards: RecapCardDraft[];
};

export type BriefMatchupRow = {
  week: number;
  teamKey: string;
  opponentTeamKey: string | null;
  points: string | null;
  projectedPoints: string | null;
  isWinner: boolean | null;
  status: string | null;
};

export type BriefRosterRow = {
  teamKey: string;
  week: number;
  playerKey: string;
  playerName: string | null;
  displayPosition: string | null;
  selectedPosition: string | null;
  raw: unknown;
};

export type BriefTransactionRow = {
  type: string | null;
  status: string | null;
  timestamp: Date | null;
  faabBid: number | null;
  players: unknown;
};

export type BriefTeamRow = {
  teamKey: string;
  name: string;
  managers: unknown;
};

export type BriefInput = {
  leagueKey: string;
  leagueName: string;
  week: number;
  weekStart: string | null;
  weekEnd: string | null;
  teams: BriefTeamRow[];
  matchups: BriefMatchupRow[];
  rosters: BriefRosterRow[];
  transactions: BriefTransactionRow[];
};
