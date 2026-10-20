import { complete } from "../minimax/client";
import { pickAngle, scoreResults, scoreWaivers } from "./angles";
import { columnist } from "./columnist";
import { columnProse, parseColumn, slugifyColumn, type ColumnCopy } from "./copy";
import { briefText, unexpectedNumbers } from "./guard";
import {
  findWeekColumn,
  insertOpinionColumn,
  loadStandings,
  loadWaiverAdds,
  loadWeekLines,
  resolveLeague,
  usedAngleKeys,
} from "./store";
import type { OpinionDesk } from "./types";

const SYSTEM = [
  "You are Casey Dunn, columnist for a fantasy football news site.",
  "Write a sharp opinion column that argues the claim.",
  "A hot take is welcome when the brief supports it.",
  "Use only numbers that appear in the brief.",
  "Do not invent stats, ranks, scores, bids, records, or weeks.",
  "Include one sentence that states the counter-evidence.",
  'Reply with JSON only, no markdown, in this shape: {"headline":"...","dek":"...","paragraphs":["...","..."]}.',
  "Write three or four short paragraphs.",
].join(" ");

export type WriteOpinionResult =
  | { outcome: "draft" | "needs-edit"; slug: string; headline: string }
  | { outcome: "exists"; slug: string }
  | { outcome: "no-angle" };

export async function writeOpinion(desk: OpinionDesk): Promise<WriteOpinionResult> {
  const league = await resolveLeague();
  const existing = await findWeekColumn(league.leagueKey, league.currentWeek, desk);
  if (existing) return { outcome: "exists", slug: existing.slug };

  const standings = await loadStandings(league.leagueKey);
  const angles =
    desk === "results"
      ? scoreResults(standings, await loadWeekLines(league.leagueKey, standings))
      : scoreWaivers(standings, await loadWaiverAdds(league.leagueKey, standings));
  const angle = pickAngle(angles, await usedAngleKeys(league.leagueKey));
  if (!angle) return { outcome: "no-angle" };

  const brief = briefText({
    leagueName: league.name,
    week: league.currentWeek,
    claim: angle.claim,
    evidence: angle.evidence,
    counterEvidence: angle.counterEvidence,
  });
  let copy = await requestColumn(brief);
  let rejected = unexpectedNumbers(columnProse(copy), brief);
  if (rejected.length > 0) {
    copy = await requestColumn(brief, rejected);
    rejected = unexpectedNumbers(columnProse(copy), brief);
  }

  const status = rejected.length > 0 ? "needs-edit" : "draft";
  const slug = slugifyColumn(copy.headline, league.currentWeek, desk);
  const saved = await insertOpinionColumn({
    slug,
    leagueKey: league.leagueKey,
    week: league.currentWeek,
    desk,
    headline: copy.headline,
    dek: copy.dek,
    body: copy.paragraphs.join("\n\n"),
    status,
    angleId: angle.angleId,
    brief: {
      claim: angle.claim,
      evidence: angle.evidence,
      counterEvidence: angle.counterEvidence,
      heat: angle.heat,
    },
    teamKeys: angle.teamKeys,
    columnistName: columnist.name,
    columnistBeat: columnist.beat,
    columnistInitials: columnist.initials,
  });
  if (saved.outcome === "exists") {
    const row = await findWeekColumn(league.leagueKey, league.currentWeek, desk);
    return { outcome: "exists", slug: row?.slug ?? slug };
  }
  return { outcome: status, slug: saved.slug, headline: copy.headline };
}

export function describeWrite(desk: OpinionDesk, result: WriteOpinionResult): string {
  const label = desk === "waivers" ? "waiver" : "results";
  if (result.outcome === "exists") return `This week's ${label} column already exists.`;
  if (result.outcome === "no-angle") return `No ${label} claim cleared the bar this week.`;
  if (result.outcome === "needs-edit") {
    return `Saved for edit. Some numbers were not in the brief: ${result.headline}`;
  }
  return `Draft ready: ${result.headline}`;
}

async function requestColumn(brief: string, rejected: string[] = []): Promise<ColumnCopy> {
  const content = await complete([
    { role: "system", content: SYSTEM },
    { role: "user", content: userMessage(brief, rejected) },
  ]);
  return parseColumn(content);
}

function userMessage(brief: string, rejected: string[]) {
  if (rejected.length === 0) return `Write the column from this brief.\n\n${brief}`;
  return [
    "Write the column again from this brief.",
    `The previous draft used numbers that are not in the brief: ${rejected.join(", ")}.`,
    "Remove them. Every number in the headline, dek, and paragraphs must appear in the brief.",
    "",
    brief,
  ].join("\n");
}
