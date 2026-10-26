import {
  collectNameTokens,
  collectNumbers,
  nameErrors,
  numberErrors,
  ordinaryWords,
  pointTotalErrors,
  rankErrors,
  resultErrors,
  type PlayerPoints,
} from "../facts/claims";
import type { RecapDraft, WeekBrief } from "./types";

const ORDINARY_WORDS = ordinaryWords();

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateRecap(brief: WeekBrief, draft: RecapDraft, notes: string[] = []): ValidationResult {
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
  const names = collectNameTokens(brief);
  for (const note of notes) {
    collectNumbers(note, allowed);
    collectNameTokens(note, names);
  }
  errors.push(...numberErrors(copy, allowed));
  errors.push(...nameErrors(copy, names, ORDINARY_WORDS));
  errors.push(
    ...resultErrors(
      copy,
      brief.matchups.map((matchup) => ({
        result: matchup.result,
        winnerName: matchup.winner.teamName,
        loserName: matchup.loser.teamName,
      })),
    ),
  );
  errors.push(
    ...rankErrors(
      copy,
      brief.matchups.flatMap((matchup) =>
        [matchup.winner, matchup.loser].map((side) => ({
          name: side.teamName,
          before: side.rankBefore,
          after: side.rankAfter,
        })),
      ),
    ),
  );
  errors.push(...pointTotalErrors(copy, playersIn(brief)));

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

function playersIn(brief: WeekBrief): PlayerPoints[] {
  const players: PlayerPoints[] = [];
  for (const matchup of brief.matchups) {
    for (const side of [matchup.winner, matchup.loser]) {
      for (const player of side.lineup ?? []) players.push({ name: player.name, weekPoints: player.weekPoints });
      for (const performer of side.topPerformers) players.push({ name: performer.name, weekPoints: performer.points });
    }
  }
  return players;
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}
