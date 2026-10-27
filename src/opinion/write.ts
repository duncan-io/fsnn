import { slotFor } from "../backfill/schedule";
import { draftUntil, OPINION_GOAL, reviewWithMinimax } from "../desk/review";
import { illustrateStored } from "../images/illustrate";
import { minimaxJsonDraft } from "../minimax/draft";
import { assignPersona, IN_UNIVERSE, type Persona } from "../personas/staff";
import { loadWeekDossier } from "../facts/dossier";
import { teamFactLines } from "../facts/sheet";
import type { TeamFacts } from "../facts/types";
import type { LookupPlayer } from "../search/lookup";
import { pickAngle, scoreResults, scoreWaivers } from "./angles";
import { columnProse, readColumn, slugifyColumn, type ColumnCopy } from "./copy";
import { briefText, reviewOpinion } from "./guard";
import {
  findWeekColumn,
  insertOpinionColumn,
  loadStandings,
  loadWaiverAdds,
  loadWeekLines,
  replaceOpinionColumn,
  resolveLeague,
  usedAngleKeys,
} from "./store";
import type { OpinionDesk } from "./types";

const OPINION_CRAFT = [
  "Write a sharp opinion column that argues the claim.",
  "Use only numbers that appear in the brief or in a lookup_player result from this draft.",
  "Do not invent stats, ranks, scores, bids, records, or weeks.",
  "Call lookup_player with a rostered player's name when that player's week points need an explanation the brief does not already give. Skip the call when a stat line is already in the brief.",
  "A player's points in the brief stay the score. A lookup cannot replace them.",
  "Include one sentence that states the counter-evidence.",
  'Reply with JSON only, no markdown, in this shape: {"headline":"...","dek":"...","paragraphs":["...","..."]}.',
  "Write three or four short paragraphs.",
].join(" ");

function opinionStyle(persona: Persona): string {
  return `${persona.voice}\n\n${IN_UNIVERSE}\n\n${OPINION_CRAFT}`;
}

export type WriteOpinionOptions = {
  week?: number;
  backfill?: boolean;
};

export type WriteOpinionResult =
  | { outcome: "draft" | "published" | "needs-edit"; slug: string; headline: string }
  | { outcome: "exists"; slug: string }
  | { outcome: "no-angle" };

export async function writeOpinion(
  desk: OpinionDesk,
  options: WriteOpinionOptions = {},
): Promise<WriteOpinionResult> {
  const league = await resolveLeague();
  const week = options.week ?? league.currentWeek;
  const backfill = options.backfill === true;
  if (!backfill) {
    const existing = await findWeekColumn(league.leagueKey, week, desk);
    if (existing) return { outcome: "exists", slug: existing.slug };
  }

  const standings = await loadStandings(league.leagueKey, backfill ? week : undefined);
  const angles =
    desk === "results"
      ? scoreResults(standings, await loadWeekLines(league.leagueKey, standings, backfill ? week : undefined))
      : scoreWaivers(standings, await loadWaiverAdds(league.leagueKey, standings, backfill ? { week } : {}));
  const angle = pickAngle(angles, await usedAngleKeys(league.leagueKey, backfill ? week : undefined));
  if (!angle) return { outcome: "no-angle" };

  const dossier = await loadWeekDossier(league.leagueKey, week);
  const weekEnd = dossier?.weekEnd ?? null;
  if (backfill && !weekEnd) throw new Error(`Week ${week} has no end date.`);
  const slice = (dossier?.teams ?? []).filter((team) => angle.teamKeys.includes(team.teamKey));
  const persona = assignPersona(desk, `${league.leagueKey}:${week}:${desk}`);
  const brief = [
    briefText({
      leagueName: league.name,
      week,
      claim: angle.claim,
      evidence: angle.evidence,
      counterEvidence: angle.counterEvidence,
    }),
    ...slice.flatMap((team) => teamFactLines(team)),
  ].join("\n");
  const players = lookupPlayers(dossier?.teams ?? []);
  const facts = opinionFacts(slice);
  const written = await draftUntil({
    write: (notes) => requestColumn(persona, brief, players, week, notes),
    facts: (drafted) => reviewOpinion(columnProse(drafted.copy), brief, drafted.snippets, facts),
    edit: (drafted) => reviewWithMinimax({ goal: OPINION_GOAL, brief, copy: columnProse(drafted.copy) }),
  });
  const copy = written.draft.copy;
  const passed = written.ok;
  const status = passed ? (backfill ? "published" : "draft") : "needs-edit";
  const slug = slugifyColumn(copy.headline, week, desk);
  const values = {
    slug,
    leagueKey: league.leagueKey,
    week,
    desk,
    headline: copy.headline,
    dek: copy.dek,
    body: copy.paragraphs.join("\n\n"),
    status,
    publishedAt: status === "published" && weekEnd ? slotFor(weekEnd, desk === "waivers" ? "waivers" : "results") : null,
    reviewNotes: passed ? null : written.notes,
    angleId: angle.angleId,
    brief: {
      claim: angle.claim,
      evidence: angle.evidence,
      counterEvidence: angle.counterEvidence,
      heat: angle.heat,
    },
    teamKeys: angle.teamKeys,
    columnistName: persona.name,
    columnistBeat: persona.beat,
    columnistInitials: persona.initials,
  };
  const saved = backfill ? await replaceOpinionColumn(values) : await insertOpinionColumn(values);
  if (saved.outcome === "exists") {
    const row = await findWeekColumn(league.leagueKey, week, desk);
    return { outcome: "exists", slug: row?.slug ?? slug };
  }
  if (passed) {
    await illustrateStored({
      kind: "opinion",
      slug: saved.slug,
      headline: copy.headline,
      dek: copy.dek,
    });
  }
  return { outcome: status, slug: saved.slug, headline: copy.headline };
}

export function describeWrite(desk: OpinionDesk, result: WriteOpinionResult): string {
  const label = desk === "waivers" ? "waiver" : "results";
  if (result.outcome === "exists") return `This week's ${label} column already exists.`;
  if (result.outcome === "no-angle") return `No ${label} claim cleared the bar this week.`;
  if (result.outcome === "needs-edit") return `Needs edit: ${result.headline}`;
  if (result.outcome === "draft") return `Draft ready: ${result.headline}`;
  return `Published: ${result.headline}`;
}

async function requestColumn(
  persona: Persona,
  brief: string,
  players: LookupPlayer[],
  week: number,
  rejected: string[] = [],
): Promise<{ copy: ColumnCopy; snippets: string[] }> {
  const drafted = await minimaxJsonDraft({
    system: opinionStyle(persona),
    user: userMessage(brief, rejected),
    players,
    week,
    parse: readColumn,
  });
  return { copy: drafted.value, snippets: drafted.snippets };
}

function userMessage(brief: string, rejected: string[]) {
  if (rejected.length === 0) return `Write the column from this brief.\n\n${brief}`;
  return [
    "Write the column again from this brief.",
    `The previous draft failed these checks: ${rejected.join(" ")}`,
    "Remove them. Every number and name in the headline, dek, and paragraphs must appear in the brief or a lookup.",
    "",
    brief,
  ].join("\n");
}

function lookupPlayers(teams: TeamFacts[]): LookupPlayer[] {
  const players: LookupPlayer[] = [];
  const seen = new Set<string>();
  for (const team of teams) {
    for (const player of team.lineup) {
      const key = player.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({ name: player.name, nflTeam: player.nflTeam, weekPoints: player.weekPoints });
    }
  }
  return players;
}

function opinionFacts(teams: TeamFacts[]) {
  const results = [];
  const seen = new Set<string>();
  for (const team of teams) {
    const week = team.weekResult;
    if (!week) continue;
    const winnerName = week.result === "loss" ? week.opponentName : team.teamName;
    const loserName = week.result === "loss" ? team.teamName : week.opponentName;
    const key = [winnerName, loserName].sort().join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      result: week.result === "tie" ? ("tie" as const) : ("win" as const),
      winnerName,
      loserName,
    });
  }
  return {
    results,
    ranks: teams.flatMap((team) => {
      const last = team.rankByWeek.at(-1);
      const previous = team.rankByWeek.at(-2) ?? last;
      if (!last || !previous) return [];
      return [{ name: team.teamName, before: previous.rank, after: last.rank }];
    }),
    players: teams.flatMap((team) => team.lineup.map((player) => ({ name: player.name, weekPoints: player.weekPoints }))),
  };
}
