import type { PlayerPoints, RankFact, ResultFact } from "../facts/claims";
import type { LookupPlayer } from "../search/lookup";

export type Speaker = "jerry" | "greg";

export type SegmentKind = "open" | "recap" | "wire" | "preview" | "close";

export type ScriptLine = {
  speaker: Speaker;
  text: string;
};

export type OutlineSection = {
  id: string;
  angle: string;
  jerry: string;
  greg: string;
  facts: string[];
  handoff: string;
};

export type PodcastOutline = {
  title: string;
  description: string;
  sections: OutlineSection[];
};

export type ScriptSegment = {
  id: string;
  kind: SegmentKind;
  matchupKey: string | null;
  lines: ScriptLine[];
};

export type PodcastScript = {
  title: string;
  description: string;
  outline: PodcastOutline;
  segments: ScriptSegment[];
};

export type PlannedSegment = {
  id: string;
  kind: SegmentKind;
  matchupKey: string | null;
  budget: number;
  facts: unknown;
  players: LookupPlayer[];
  results: ResultFact[];
  ranks: RankFact[];
  playerPoints: PlayerPoints[];
  previewTeams: [string, string] | null;
};
