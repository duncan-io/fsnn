export type StatLine = {
  label: string;
  value: number;
};

export type LineupPlayer = {
  playerKey: string;
  name: string;
  nflTeam: string | null;
  position: string | null;
  slot: string | null;
  role: "starter" | "bench";
  weekPoints: number | null;
  injuryStatus: string | null;
  injuryNote: string | null;
  percentOwned: number | null;
  seasonPoints: number | null;
  weekStats: StatLine[];
  draftRound: number | null;
  draftPick: number | null;
};

export type HeadToHead = {
  opponentName: string;
  wins: number;
  losses: number;
  ties: number;
};

export type BiggestWin = {
  opponentName: string;
  margin: number;
  week: number;
};

export type WeekResult = {
  result: "win" | "loss" | "tie";
  opponentName: string;
  points: number;
  opponentPoints: number;
};

export type PlayoffLine = {
  gamesBack: number;
  teamsAhead: number;
  weeksLeft: number | null;
};

export type TeamFacts = {
  teamKey: string;
  teamName: string;
  managerName: string | null;
  yahooRank: number | null;
  faabBalance: number | null;
  waiverPriority: number | null;
  moves: number | null;
  trades: number | null;
  lineup: LineupPlayer[];
  benchPoints: number | null;
  weekStarterPoints: number | null;
  rankByWeek: Array<{ week: number; rank: number }>;
  longestStreak: string;
  biggestWin: BiggestWin | null;
  headToHead: HeadToHead[];
  remainingOpponents: Array<{ name: string; pointsPerGame: number | null }>;
  playoff: PlayoffLine | null;
  weekResult: WeekResult | null;
};

export type LeagueFacts = {
  scoringType: string | null;
  rosterSlots: string[];
  playoffTeams: number | null;
  endWeek: number | null;
};

export type WeekDossier = {
  leagueKey: string;
  leagueName: string;
  week: number;
  weekStart: string | null;
  weekEnd: string | null;
  league: LeagueFacts;
  teams: TeamFacts[];
};
