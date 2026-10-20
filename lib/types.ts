export type ArticleKind =
  | "weekly-recap"
  | "breaking"
  | "interview"
  | "power-rankings"
  | "preview"
  | "analysis";

export type MatchupStatus = "final" | "live" | "upcoming";

export type League = {
  name: string;
  season: string;
  currentWeek: number;
};

export type Record = {
  wins: number;
  losses: number;
  ties: number;
};

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  managerName: string;
  primaryColor: string;
  secondaryColor: string;
  record: Record;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  /** Rank entering the current week, used for movement arrows. */
  previousRank: number;
  streak: string;
};

export type Matchup = {
  id: string;
  week: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: MatchupStatus;
  /** Shown in place of a score when the matchup has not started. */
  kickoffLabel?: string;
};

export type Reporter = {
  name: string;
  beat: string;
  initials: string;
};

export type PullQuote = {
  text: string;
  managerName: string;
};

export type Article = {
  id: string;
  slug: string;
  kind: ArticleKind;
  headline: string;
  dek: string;
  teamIds: string[];
  reporter: Reporter;
  publishedAt: string;
  readTimeMinutes: number;
  tags: string[];
  imageUrl?: string;
  pullQuote?: PullQuote;
};
