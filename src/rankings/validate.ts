import {
  collectNameTokens,
  collectNumbers,
  nameErrors,
  numberErrors,
  ordinaryWords,
  pointTotalErrors,
  rankErrors,
} from "../facts/claims";
import type { RankingsBrief, RankingsDraft } from "./types";

const ORDINARY_WORDS = ordinaryWords();

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

export function validateRankings(brief: RankingsBrief, draft: RankingsDraft, notes: string[] = []): ValidationResult {
  const errors: string[] = [];
  if (typeof draft?.headline !== "string" || typeof draft?.dek !== "string") {
    errors.push("Rankings are missing a headline or dek.");
  }
  if (typeof draft?.lede !== "string" || sentenceCount(draft.lede) !== 2) {
    errors.push("Lede must be two sentences.");
  }
  const entries = Array.isArray(draft?.entries) ? draft.entries : [];
  if (entries.length !== brief.teams.length) errors.push("Rankings must include every team once.");
  brief.teams.forEach((team, index) => {
    const entry = entries[index];
    if (entry?.teamKey !== team.teamKey) errors.push(`Entry ${index + 1} must be ${team.teamKey}.`);
    if (!Array.isArray(entry?.paragraphs) || entry.paragraphs.length === 0) {
      errors.push(`Entry ${team.teamKey} needs a paragraph.`);
    }
  });

  const yahooGap = brief.teams.some((team) => team.yahooRank != null && team.yahooRank !== team.rank);
  const kicker = draft?.kicker;
  if (!yahooGap && kicker != null) errors.push("Kicker must be null when power rank matches the official rank.");
  if (yahooGap && (typeof kicker !== "string" || kicker.trim() === "")) {
    errors.push("Kicker must name the gap between power rank and the official rank.");
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
    ...rankErrors(
      copy,
      brief.teams.flatMap((team) => {
        const facts = [{ name: team.teamName, before: team.previousRank, after: team.rank }];
        return team.managerName ? [...facts, { name: team.managerName, before: team.previousRank, after: team.rank }] : facts;
      }),
    ),
  );
  errors.push(
    ...pointTotalErrors(
      copy,
      brief.teams.flatMap((team) => (team.lineup ?? []).map((player) => ({ name: player.name, weekPoints: player.weekPoints }))),
    ),
  );

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function collectCopy(draft: RankingsDraft): string {
  const parts = [
    draft?.headline,
    draft?.dek,
    draft?.lede,
    draft?.kicker,
    ...(draft?.entries ?? []).flatMap((entry) => entry?.paragraphs ?? []),
  ];
  return parts.filter((part): part is string => typeof part === "string").join("\n");
}

function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
}
