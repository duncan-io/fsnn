import { collectNameTokens, nameErrors, ordinaryWords } from "../facts/claims";
import { illustrateStored } from "../images/illustrate";
import { minimaxJsonDraft } from "../minimax/draft";
import { columnProse, readColumn, slugifyColumn, type ColumnCopy } from "../opinion/copy";
import { unexpectedNumbers } from "../opinion/guard";
import { resolveLeague } from "../opinion/store";
import { assignPersona, IN_UNIVERSE, type Persona } from "../personas/staff";
import { briefText, decideBreaking, scoreBreaking } from "./candidates";
import {
  breakingState,
  insertBreakingBaseline,
  insertPublishedBreaking,
  loadBreakingFacts,
} from "./store";

const CRAFT = [
  "Write a short breaking story from the brief.",
  "Use only numbers and names that appear in the brief.",
  "Do not invent stats, ranks, scores, bids, records, or injuries.",
  'Reply with JSON only, no markdown, in this shape: {"headline":"...","dek":"...","paragraphs":["...","..."]}.',
  "Write two short paragraphs.",
].join(" ");

export type WriteBreakingResult =
  | { outcome: "baseline"; count: number }
  | { outcome: "quiet" }
  | { outcome: "capped" }
  | { outcome: "published"; slug: string; headline: string };

export async function writeBreaking(): Promise<WriteBreakingResult> {
  const league = await resolveLeague();
  const facts = await loadBreakingFacts(league.leagueKey, league.currentWeek);
  const candidates = scoreBreaking(facts);
  const state = await breakingState(league.leagueKey);
  const decision = decideBreaking({
    initialized: state.initialized,
    candidates,
    seen: state.seen,
    publishedLastDay: state.publishedLastDay,
  });

  if (decision.action === "baseline") {
    await insertBreakingBaseline(league.leagueKey, league.currentWeek, decision.candidates);
    return { outcome: "baseline", count: decision.candidates.length };
  }
  if (decision.action === "quiet") return { outcome: "quiet" };
  if (decision.action === "capped") return { outcome: "capped" };

  const candidate = decision.candidate;
  const persona = assignPersona("breaking", candidate.sourceKey);
  const brief = briefText(candidate);
  let copy = await requestStory(persona, brief, league.currentWeek);
  let rejected = reviewBreaking(copy, brief);
  if (rejected.length > 0) {
    copy = await requestStory(persona, brief, league.currentWeek, rejected);
    rejected = reviewBreaking(copy, brief);
  }
  if (rejected.length > 0) throw new Error(rejected.join("\n"));

  const saved = await insertPublishedBreaking({
    leagueKey: league.leagueKey,
    week: league.currentWeek,
    kind: candidate.kind,
    sourceKey: candidate.sourceKey,
    heat: candidate.heat,
    slug: slugifyColumn(copy.headline, league.currentWeek, "breaking"),
    headline: copy.headline,
    dek: copy.dek,
    body: copy.paragraphs.join("\n\n"),
    brief: { lines: candidate.lines },
    teamKeys: candidate.teamKeys,
    reporterName: persona.name,
    reporterBeat: persona.beat,
    reporterInitials: persona.initials,
    eventAt: candidate.eventAt,
  });
  await illustrateStored({
    kind: "breaking",
    slug: saved.slug,
    headline: copy.headline,
    dek: copy.dek,
  });
  return { outcome: "published", slug: saved.slug, headline: copy.headline };
}

export function describeBreaking(result: WriteBreakingResult): string {
  if (result.outcome === "baseline") {
    return result.count === 0
      ? "Baselined the wire. Nothing published."
      : `Baselined ${result.count} events. Nothing published.`;
  }
  if (result.outcome === "quiet") return "Nothing cleared the bar.";
  if (result.outcome === "capped") return "The wire already published twice in the last day.";
  return `Published: ${result.headline}`;
}

export function reviewBreaking(copy: ColumnCopy, brief: string): string[] {
  const prose = columnProse(copy);
  const errors: string[] = [];
  if (copy.paragraphs.length !== 2) errors.push("Write two paragraphs.");
  for (const token of unexpectedNumbers(prose, brief)) errors.push(`Invented number ${token}.`);
  errors.push(...nameErrors(prose, collectNameTokens(brief), ordinaryWords()));
  return errors;
}

function breakingStyle(persona: Persona): string {
  return `${persona.voice}\n\n${IN_UNIVERSE}\n\n${CRAFT}`;
}

async function requestStory(
  persona: Persona,
  brief: string,
  week: number,
  rejected: string[] = [],
): Promise<ColumnCopy> {
  const drafted = await minimaxJsonDraft({
    system: breakingStyle(persona),
    user: userMessage(brief, rejected),
    players: [],
    week,
    lookupPlayer: false,
    parse: readColumn,
  });
  return drafted.value;
}

function userMessage(brief: string, rejected: string[]) {
  if (rejected.length === 0) return `Write the story from this brief.\n\n${brief}`;
  return [
    "Write the story again from this brief.",
    `The previous draft failed these checks: ${rejected.join(" ")}`,
    "Remove them. Every number and name in the headline, dek, and paragraphs must appear in the brief.",
    "Write two short paragraphs.",
    "",
    brief,
  ].join("\n");
}
