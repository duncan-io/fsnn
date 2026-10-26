import { minimaxJsonDraft } from "../minimax/draft";
import type { WeekBrief } from "../recap/types";
import { auditScript, auditSection, reviewPersonas } from "./audit";
import { planSegments } from "./budget";
import { writeOutline } from "./outline";
import type { PreviewBrief } from "./preview";
import { episodeTitle } from "./show";
import type {
  OutlineSection,
  PlannedSegment,
  PodcastOutline,
  PodcastScript,
  ScriptLine,
  ScriptSegment,
} from "./types";
import { sectionStyle } from "./voice";

const ATTEMPTS = 3;
const DRAFT_TOKENS = 3000;

export async function writeScript(recap: WeekBrief, preview: PreviewBrief | null): Promise<PodcastScript> {
  const plan = planSegments(recap, preview);
  const outline = await writeOutline(plan, recap.week);
  const segments: ScriptSegment[] = [];
  for (const planned of plan) {
    const section = sectionFor(outline, planned.id);
    const handoff = nextHandoff(outline, planned.id);
    segments.push(await draftSection(planned, section, handoff, tailOf(segments), recap.week, []));
  }
  let script = assemble(recap.week, outline, segments);
  let check = auditScript(plan, script);
  if (!check.ok) {
    if (check.sectionIds.length === 0) throw new Error(check.errors.join("\n"));
    const flagged = new Set(check.sectionIds);
    const rewritten: ScriptSegment[] = [];
    for (const planned of plan) {
      const current = script.segments.find((segment) => segment.id === planned.id);
      if (current && !flagged.has(planned.id)) {
        rewritten.push(current);
        continue;
      }
      rewritten.push(
        await draftSection(planned, sectionFor(outline, planned.id), nextHandoff(outline, planned.id), tailOf(rewritten), recap.week, check.errors),
      );
    }
    script = assemble(recap.week, outline, rewritten);
    check = auditScript(plan, script);
    if (!check.ok) throw new Error(check.errors.join("\n"));
  }
  return script;
}

async function draftSection(
  planned: PlannedSegment,
  section: OutlineSection,
  handoff: string,
  tail: ScriptLine[],
  week: number,
  prior: string[],
): Promise<ScriptSegment> {
  let errors = [...prior];
  let last = `Section ${planned.id} failed the audit.`;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    let lines: ScriptLine[];
    let snippets: string[];
    try {
      const drafted = await requestSection(planned, section, handoff, tail, week, errors);
      lines = drafted.lines;
      snippets = drafted.snippets;
    } catch (error) {
      last = error instanceof Error ? error.message : "Section draft could not be read.";
      errors = [last];
      continue;
    }
    const segment: ScriptSegment = {
      id: planned.id,
      kind: planned.kind,
      matchupKey: planned.matchupKey,
      lines,
    };
    const audited = auditSection(planned, segment, snippets);
    if (!audited.ok) {
      last = audited.errors.join("\n");
      errors = audited.errors;
      continue;
    }
    const persona = await reviewPersonas(segment, section);
    if (persona.length > 0) {
      last = persona.join("\n");
      errors = persona;
      continue;
    }
    return segment;
  }
  throw new Error(last);
}

async function requestSection(
  planned: PlannedSegment,
  section: OutlineSection,
  handoff: string,
  tail: ScriptLine[],
  week: number,
  errors: string[],
) {
  const correction = errors.length > 0 ? `\n\nFix these problems and return the full JSON again:\n${errors.join("\n")}` : "";
  const result = await minimaxJsonDraft({
    system: sectionStyle(),
    user: `${JSON.stringify({
      id: planned.id,
      kind: planned.kind,
      budget: planned.budget,
      outline: section,
      nextHandoff: handoff,
      previousLines: tail,
      facts: planned.facts,
    })}${correction}`,
    players: planned.players,
    week,
    maxTokens: DRAFT_TOKENS,
    temperature: 0.8,
    parse: readLines,
  });
  return { lines: result.value, snippets: result.snippets };
}

export function readLines(value: unknown): ScriptLine[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { lines?: unknown }).lines)) {
    throw new Error("Section JSON is missing lines.");
  }
  const lines: ScriptLine[] = [];
  for (const line of (value as { lines: unknown[] }).lines) {
    if (!line || typeof line !== "object") continue;
    const speaker = (line as { speaker?: unknown }).speaker;
    const text = (line as { text?: unknown }).text;
    if ((speaker !== "jerry" && speaker !== "greg") || typeof text !== "string" || !text.trim()) continue;
    lines.push({ speaker, text: text.trim() });
  }
  if (lines.length === 0) throw new Error("Section JSON has no lines.");
  return lines;
}

function assemble(week: number, outline: PodcastOutline, segments: ScriptSegment[]): PodcastScript {
  return {
    title: episodeTitle(week, outline.title),
    description: outline.description,
    outline,
    segments,
  };
}

function sectionFor(outline: PodcastOutline, id: string): OutlineSection {
  const section = outline.sections.find((item) => item.id === id);
  if (!section) throw new Error(`Outline is missing ${id}.`);
  return section;
}

function nextHandoff(outline: PodcastOutline, id: string): string {
  const index = outline.sections.findIndex((section) => section.id === id);
  return outline.sections[index + 1]?.handoff ?? "";
}

function tailOf(segments: ScriptSegment[]): ScriptLine[] {
  return segments.flatMap((segment) => segment.lines).slice(-4);
}
