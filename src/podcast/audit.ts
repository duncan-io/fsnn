import {
  capitalizedWords,
  collectNameTokens,
  collectNumbers,
  nameErrors,
  normalizeToken,
  numberErrors,
  ordinaryWords,
  pointTotalErrors,
  rankErrors,
  resultErrors,
} from "../facts/claims";
import { completeTurn } from "../minimax/client";
import { extractJson } from "../minimax/json";
import { personas } from "../personas/staff";
import { SHOW } from "./show";
import { reviewerStyle } from "./voice";
import type { OutlineSection, PlannedSegment, PodcastOutline, PodcastScript, ScriptLine, ScriptSegment } from "./types";

const MIN_WORDS = 1650;
const MAX_WORDS = 2300;
const MIN_SHARE = 0.35;
const TURN_LIMIT = 120;
const PHRASE_WORDS = 6;

const ORDINARY = ordinaryWords();
const HOST_NAMES = ["dig", "greg", "jerry", "pell", "crowe"];

export type AuditResult = { ok: true } | { ok: false; errors: string[] };

export type ScriptAudit = { ok: true } | { ok: false; errors: string[]; sectionIds: string[] };

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function auditOutline(plan: PlannedSegment[], outline: PodcastOutline): AuditResult {
  const errors: string[] = [];
  const expected = plan.map((segment) => segment.id);
  const got = outline.sections.map((section) => section.id);
  if (expected.join("\n") !== got.join("\n")) errors.push("Outline sections do not match the plan.");
  const allowed = collectNumbers(plan.map((segment) => segment.facts));
  const names = allowedNames(plan.map((segment) => segment.facts));
  const framing = `${outline.title}\n${outline.description}`;
  errors.push(...numberErrors(framing, allowed));
  errors.push(...nameErrors(framing, names, ORDINARY));
  errors.push(...unsafeCopy(framing));
  for (const section of outline.sections) {
    const segment = plan.find((item) => item.id === section.id);
    const slice = segment?.facts ?? {};
    const copy = [section.angle, section.jerry, section.greg, section.handoff, ...section.facts].join("\n");
    errors.push(...numberErrors(copy, collectNumbers(slice)));
    errors.push(...nameErrors(copy, allowedNames(slice), ORDINARY));
    errors.push(...unsafeCopy(copy));
    if (!section.angle.trim() || sameText(section.jerry, section.greg)) {
      errors.push(`Jerry and Greg need different stances in ${section.id}.`);
    }
    if (section.facts.length === 0) errors.push(`Section ${section.id} needs a fact.`);
  }
  const last = outline.sections.at(-1)?.id;
  for (const section of outline.sections) {
    if (section.id !== last && !section.handoff.trim()) errors.push(`Section ${section.id} needs a handoff.`);
  }
  errors.push(...payoffErrors(plan, outline));
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function auditSection(segment: PlannedSegment, script: ScriptSegment, notes: string[] = []): AuditResult {
  const errors: string[] = [];
  const lines = script.lines ?? [];
  if (!Array.isArray(lines) || lines.length === 0) errors.push(`Section ${segment.id} has no lines.`);
  const speakers = new Set<string>();
  for (const line of lines) {
    if (line.speaker !== "jerry" && line.speaker !== "greg") errors.push(`Unknown speaker ${String(line.speaker)}.`);
    else speakers.add(line.speaker);
    if (wordCount(line.text) > TURN_LIMIT) errors.push("Turn is longer than 120 words.");
  }
  if (!speakers.has("jerry") || !speakers.has("greg")) errors.push("Both hosts have to speak in this section.");
  const copy = lines.map((line) => line.text).join("\n");
  const words = wordCount(copy);
  const low = Math.floor(segment.budget * 0.7);
  const high = Math.ceil(segment.budget * 1.3);
  if (words < low || words > high) errors.push(`Section is outside its word budget. It has ${words} words.`);
  const allowed = collectNumbers(segment.facts);
  const names = allowedNames(segment.facts);
  for (const note of notes) {
    collectNumbers(note, allowed);
    collectNameTokens(note, names);
  }
  errors.push(...numberErrors(copy, allowed));
  errors.push(...nameErrors(copy, names, ORDINARY));
  errors.push(...resultErrors(copy, segment.results));
  errors.push(...rankErrors(copy, segment.ranks));
  errors.push(...pointTotalErrors(copy, segment.playerPoints));
  errors.push(...unsafeCopy(copy));
  if ((segment.kind === "open" || segment.kind === "close") && !/\bthe dig\b/i.test(copy)) {
    errors.push(segment.kind === "open" ? "The open must say The Dig." : "The close must say The Dig.");
  }
  if (segment.kind === "preview" && segment.previewTeams) {
    errors.push(...spoilerErrors(copy, segment.previewTeams));
  }
  if (/\blast week\b/i.test(copy) && !hasLastShow(segment.facts) && !notes.some((note) => note.includes("Last show week"))) {
    errors.push("Last week is not on the sheet.");
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function auditScript(plan: PlannedSegment[], script: PodcastScript): ScriptAudit {
  const errors: string[] = [];
  const sectionIds = new Set<string>();
  const expected = plan.map((segment) => segment.id);
  const got = script.segments.map((segment) => segment.id);
  for (const id of expected) {
    if (!got.includes(id)) {
      errors.push(`Missing section ${id}.`);
      sectionIds.add(id);
    }
  }
  for (const id of got) {
    if (!expected.includes(id)) errors.push(`Unknown section ${id}.`);
  }
  const jerry = wordsBy(script, "jerry");
  const greg = wordsBy(script, "greg");
  const total = jerry + greg;
  if (total < MIN_WORDS || total > MAX_WORDS) {
    errors.push(`Episode is ${total} words, outside ${MIN_WORDS} to ${MAX_WORDS}.`);
    const ranked = [...script.segments].sort((a, b) => wordsIn(b) - wordsIn(a));
    for (const segment of ranked.slice(0, 2)) sectionIds.add(segment.id);
  }
  if (total > 0 && jerry / total < MIN_SHARE) {
    errors.push("Jerry has less than 35% of the words.");
    for (const segment of loudest(script, "greg")) sectionIds.add(segment.id);
  }
  if (total > 0 && greg / total < MIN_SHARE) {
    errors.push("Greg has less than 35% of the words.");
    for (const segment of loudest(script, "jerry")) sectionIds.add(segment.id);
  }
  for (const repeat of repeatedPhrases(script.segments)) {
    errors.push(`Repeated phrase "${repeat.phrase}".`);
    for (const id of repeat.sectionIds) sectionIds.add(id);
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors, sectionIds: [...sectionIds] };
}

export async function reviewPersonas(
  segment: ScriptSegment,
  section: OutlineSection,
  turn: typeof completeTurn = completeTurn,
  lastShow: unknown = null,
): Promise<string[]> {
  const result = await turn(
    [
      { role: "system", content: reviewerStyle() },
      {
        role: "user",
        content: JSON.stringify({
          voices: { jerry: personas.jerry.voice, greg: personas.greg.voice },
          stance: { jerry: section.jerry, greg: section.greg },
          lastShow,
          lines: segment.lines,
        }),
      },
    ],
    undefined,
    { maxTokens: 1500, temperature: 0.2 },
  );
  if (!result.content) return ["Persona review was empty."];
  try {
    return readFlags(extractJson(result.content));
  } catch {
    return ["Persona review was not JSON."];
  }
}

export function readFlags(value: unknown): string[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { flags?: unknown }).flags)) {
    return ["Persona review was not JSON."];
  }
  return (value as { flags: unknown[] }).flags.flatMap((flag) => {
    if (!flag || typeof flag !== "object") return [];
    const reason = (flag as { reason?: unknown }).reason;
    const line = (flag as { line?: unknown }).line;
    if (typeof reason !== "string" || !reason.trim()) return [];
    const where = typeof line === "number" ? `Line ${line}: ` : "";
    return [`${where}${reason.trim()}`];
  });
}

function payoffErrors(plan: PlannedSegment[], outline: PodcastOutline): string[] {
  const openPlan = plan.find((segment) => segment.id === "open");
  const open = outline.sections.find((section) => section.id === "open");
  const close = outline.sections.find((section) => section.id === "close");
  if (!openPlan || !open || !close || !hasLastShow(openPlan.facts)) return [];
  const tokens = new Set<string>();
  for (const word of capitalizedWords(`${open.angle}\n${open.jerry}\n${open.greg}`)) {
    const token = normalizeToken(word);
    if (!token || ORDINARY.has(token) || HOST_NAMES.includes(token)) continue;
    tokens.add(token);
  }
  if (tokens.size === 0) return [];
  const angle = close.angle.toLowerCase();
  for (const token of tokens) {
    if (angle.includes(token)) return [];
  }
  return ["The close has to answer the open."];
}

function hasLastShow(facts: unknown): boolean {
  if (!facts || typeof facts !== "object" || !("desk" in facts)) return false;
  const desk = (facts as { desk: unknown }).desk;
  return !!desk && typeof desk === "object" && Array.isArray((desk as { sections?: unknown }).sections);
}

function allowedNames(value: unknown): Set<string> {
  const names = collectNameTokens(value);
  for (const token of HOST_NAMES) names.add(token);
  names.add(SHOW.shortTitle.toLowerCase());
  return names;
}

function unsafeCopy(copy: string): string[] {
  const errors: string[] = [];
  if (/\bfantasy\b/i.test(copy)) errors.push("Do not say fantasy.");
  if (/\byahoo\b/i.test(copy)) errors.push("Do not say Yahoo.");
  if (/[*_`#\[\]{}]|https?:\/\/|\p{Extended_Pictographic}/u.test(copy)) errors.push("No markdown, emoji, or links.");
  if (/\([^)]+\)/.test(copy)) errors.push("No stage directions.");
  return errors;
}

function spoilerErrors(copy: string, teams: [string, string]): string[] {
  const [home, away] = teams;
  const errors: string[] = [];
  for (const sentence of copy.split(/(?<=[.!?])\s+/)) {
    const names = [home, away].filter((name) => sentence.toLowerCase().includes(name.toLowerCase()));
    if (names.length === 2 && /\b(beat|beats|defeated|won)\b/i.test(sentence)) {
      errors.push(`${home} and ${away} have not played yet.`);
    }
  }
  return errors;
}

function sameText(left: string, right: string): boolean {
  const a = left.toLowerCase().replace(/\s+/g, " ").trim();
  const b = right.toLowerCase().replace(/\s+/g, " ").trim();
  return !a || !b || a === b;
}

function wordsBy(script: PodcastScript, speaker: ScriptLine["speaker"]): number {
  return script.segments.reduce(
    (sum, segment) => sum + segment.lines.filter((line) => line.speaker === speaker).reduce((inner, line) => inner + wordCount(line.text), 0),
    0,
  );
}

function wordsIn(segment: ScriptSegment): number {
  return wordCount(segment.lines.map((line) => line.text).join(" "));
}

function loudest(script: PodcastScript, speaker: ScriptLine["speaker"]): ScriptSegment[] {
  return [...script.segments]
    .sort((a, b) => speakerWords(b, speaker) - speakerWords(a, speaker))
    .slice(0, 2);
}

function speakerWords(segment: ScriptSegment, speaker: ScriptLine["speaker"]): number {
  return segment.lines.filter((line) => line.speaker === speaker).reduce((sum, line) => sum + wordCount(line.text), 0);
}

function repeatedPhrases(segments: ScriptSegment[]): Array<{ phrase: string; sectionIds: string[] }> {
  const seen = new Map<string, string[]>();
  for (const segment of segments) {
    const phrases = new Set<string>();
    for (const line of segment.lines) {
      const words = line.text.toLowerCase().replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
      if (words.length >= PHRASE_WORDS) phrases.add(words.slice(0, PHRASE_WORDS).join(" "));
      for (let index = 0; index <= words.length - PHRASE_WORDS; index += 1) {
        const phrase = words.slice(index, index + PHRASE_WORDS).join(" ");
        if (distinctive(phrase)) phrases.add(phrase);
      }
    }
    for (const phrase of phrases) {
      const ids = seen.get(phrase) ?? [];
      if (!ids.includes(segment.id)) ids.push(segment.id);
      seen.set(phrase, ids);
    }
  }
  return [...seen.entries()].flatMap(([phrase, ids]) => (ids.length > 2 ? [{ phrase, sectionIds: ids.slice(2) }] : []));
}

function distinctive(phrase: string): boolean {
  const common = new Set(["the", "a", "and", "of", "to", "in", "that", "it", "is", "for", "on", "with", "this", "week", "but"]);
  return phrase.split(" ").some((word) => !common.has(word));
}
