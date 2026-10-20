export type OpinionDesk = "results" | "waivers";

export type OpinionStatus = "draft" | "needs-edit" | "published" | "discarded";

export type OpinionBrief = {
  claim: string;
  evidence: string[];
  counterEvidence: string[];
  heat: number;
};

export type Angle = {
  angleId: string;
  claim: string;
  evidence: string[];
  counterEvidence: string[];
  heat: number;
  teamKeys: string[];
};

export type TeamSeason = {
  teamKey: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
  moves: number;
};

export type WeekLine = {
  week: number;
  teamKey: string;
  teamName: string;
  points: number;
  projectedPoints: number;
  opponentName: string;
  opponentPoints: number;
  seasonPointsFor: number;
  wins: number;
  losses: number;
  ties: number;
};

export type WaiverAdd = {
  teamKey: string;
  teamName: string;
  playerName: string;
  bid: number;
  seasonPoints: number | null;
  wins: number;
  losses: number;
  ties: number;
  rank: number;
  pointsFor: number;
};
