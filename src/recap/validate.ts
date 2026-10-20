import type { RecapDraft, WeekBrief } from "./types";

const ORDINARY_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "nor",
  "but",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "from",
  "with",
  "after",
  "before",
  "over",
  "under",
  "into",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "not",
  "no",
  "week",
  "final",
  "finals",
  "recap",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "night",
  "nfl",
  "faab",
  "vs",
]);

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateRecap(brief: WeekBrief, draft: RecapDraft): ValidationResult {
  const errors: string[] = [];
  const column = draft?.column;
  const cards = draft?.cards;
  if (!column || typeof column.headline !== "string" || typeof column.dek !== "string") {
    errors.push("Column is missing a headline or dek.");
  }
  if (!column || typeof column.lede !== "string" || sentenceCount(column.lede) < 2) {
    errors.push("Lede must be two sentences.");
  }
  if (!Array.isArray(cards)) errors.push("Cards must be a list.");

  const expected = new Set(brief.matchups.map((matchup) => matchup.matchupKey));
  const sections = Array.isArray(column?.sections) ? column.sections : [];
  const sectionKeys = new Set(sections.map((section) => section?.matchupKey));
  const cardKeys = new Set((Array.isArray(cards) ? cards : []).map((card) => card?.matchupKey));
  for (const key of expected) {
    if (!sectionKeys.has(key)) errors.push(`Missing section for ${key}.`);
    if (!cardKeys.has(key)) errors.push(`Missing card for ${key}.`);
  }
  for (const key of sectionKeys) {
    if (!expected.has(key)) errors.push(`Unknown matchup section ${key}.`);
  }
  for (const key of cardKeys) {
    if (!expected.has(key)) errors.push(`Unknown matchup card ${key}.`);
  }
  for (const section of sections) {
    if (!Array.isArray(section?.paragraphs) || section.paragraphs.length === 0) {
      errors.push(`Section ${section?.matchupKey ?? "unknown"} needs a paragraph.`);
    }
  }

  const transactions = brief.transactions.length;
  const kicker = column?.kicker;
  if (transactions === 0 && kicker != null) errors.push("Kicker must be null when the week has no transactions.");
  if (transactions > 0 && (typeof kicker !== "string" || kicker.trim() === "")) {
    errors.push("Kicker must mention the week's transactions.");
  }

  const copy = collectCopy(draft);
  const allowed = collectNumbers(brief);
  for (const value of numbersIn(copy)) {
    if (!allowed.some((candidate) => Math.abs(candidate - value) < 0.001)) {
      errors.push(`Invented number ${value}.`);
    }
  }
  const names = collectNames(brief);
  for (const word of capitalizedWords(copy)) {
    if (!names.has(normalizeToken(word)) && !ORDINARY_WORDS.has(normalizeToken(word))) {
      errors.push(`Unknown name ${word}.`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function collectCopy(draft: RecapDraft): string {
  const column = draft?.column;
  const parts = [
    column?.headline,
    column?.dek,
    column?.lede,
    column?.kicker,
    ...(column?.sections ?? []).flatMap((section) => [section?.heading, ...(section?.paragraphs ?? [])]),
    ...(draft?.cards ?? []).flatMap((card) => [card?.headline, card?.dek]),
  ];
  return parts.filter((part): part is string => typeof part === "string").join("\n");
}

function collectNumbers(value: unknown, into: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    into.push(value, Math.abs(value));
  }
  else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, into));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectNumbers(item, into));
  }
  return into;
}

function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function collectNames(brief: WeekBrief): Set<string> {
  const names = new Set<string>();
  const add = (name: string | null | undefined) => {
    if (!name) return;
    for (const word of name.split(/[^A-Za-z0-9'’]+/)) {
      const token = normalizeToken(word);
      if (token) names.add(token);
    }
  };
  add(brief.leagueName);
  for (const matchup of brief.matchups) {
    for (const side of [matchup.winner, matchup.loser]) {
      add(side.teamName);
      add(side.managerName);
      for (const performer of side.topPerformers) add(performer.name);
    }
  }
  for (const transaction of brief.transactions) {
    for (const player of transaction.players) {
      add(player.name);
      add(player.sourceTeamName);
      add(player.destinationTeamName);
    }
  }
  return names;
}

function capitalizedWords(text: string): string[] {
  return text.match(/[A-Z][A-Za-z0-9'’.-]*/g) ?? [];
}

function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/['’]s$/, "").replace(/[^a-z0-9]/g, "");
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}
