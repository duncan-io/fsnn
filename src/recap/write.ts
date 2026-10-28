import { draftUntil, RECAP_GOAL, reviewWithMinimax } from "../desk/review";
import { minimaxJsonDraft } from "../minimax/draft";
import type { Persona } from "../personas/staff";
import type { LookupPlayer } from "../search/lookup";
import type { RecapDraft, WeekBrief } from "./types";
import { validateRecap } from "./validate";
import { recapStyle } from "./voice";

export type WrittenRecap = { ok: true; draft: RecapDraft } | { ok: false; draft: RecapDraft; notes: string[] };

export async function writeRecap(brief: WeekBrief, persona: Persona): Promise<WrittenRecap> {
  const result = await draftUntil({
    write: (notes) => requestDraft(brief, persona, notes),
    facts: (drafted) => {
      const checked = validateRecap(brief, drafted.draft, drafted.snippets);
      return checked.ok ? [] : checked.errors;
    },
    edit: (drafted) =>
      reviewWithMinimax({
        goal: RECAP_GOAL,
        brief: JSON.stringify(brief),
        copy: recapCopy(drafted.draft),
      }),
  });
  return result.ok
    ? { ok: true, draft: result.draft.draft }
    : { ok: false, draft: result.draft.draft, notes: result.notes };
}

function recapCopy(draft: RecapDraft): string {
  return [
    draft.column.headline,
    draft.column.dek,
    draft.column.lede,
    ...draft.column.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    draft.column.kicker ?? "",
    ...draft.cards.flatMap((card) => [card.headline, card.dek]),
  ].join("\n");
}

async function requestDraft(
  brief: WeekBrief,
  persona: Persona,
  errors: string[],
): Promise<{ draft: RecapDraft; snippets: string[] }> {
  const correction =
    errors.length > 0 ? `\n\nFix these problems and return the full JSON again:\n${errors.join("\n")}` : "";
  const result = await minimaxJsonDraft({
    system: recapStyle(persona),
    user: `${JSON.stringify(brief)}${correction}`,
    players: playersIn(brief),
    week: brief.week,
    temperature: 0.8,
    parse: readRecapDraft,
  });
  return { draft: result.value, snippets: result.snippets };
}

function readRecapDraft(value: unknown): RecapDraft {
  if (!value || typeof value !== "object") throw new Error("Recap JSON was empty.");
  const row = value as { column?: unknown; cards?: unknown };
  if (!row.column || typeof row.column !== "object" || !Array.isArray(row.cards)) {
    throw new Error("Recap JSON is missing column or cards.");
  }
  const column = row.column as {
    headline?: unknown;
    dek?: unknown;
    lede?: unknown;
    sections?: unknown;
    kicker?: unknown;
  };
  if (
    typeof column.headline !== "string" ||
    typeof column.dek !== "string" ||
    typeof column.lede !== "string" ||
    !Array.isArray(column.sections)
  ) {
    throw new Error("Recap JSON is missing headline, dek, lede, or sections.");
  }
  const sections = column.sections.map((section) => {
    if (!section || typeof section !== "object") throw new Error("Recap section was not an object.");
    const item = section as { matchupKey?: unknown; heading?: unknown; paragraphs?: unknown };
    if (typeof item.matchupKey !== "string" || typeof item.heading !== "string" || !Array.isArray(item.paragraphs)) {
      throw new Error("Recap section is missing matchupKey, heading, or paragraphs.");
    }
    const paragraphs = item.paragraphs.filter((paragraph): paragraph is string => typeof paragraph === "string");
    return { matchupKey: item.matchupKey, heading: item.heading, paragraphs };
  });
  const cards = row.cards.map((card) => {
    if (!card || typeof card !== "object") throw new Error("Recap card was not an object.");
    const item = card as { matchupKey?: unknown; headline?: unknown; dek?: unknown };
    if (typeof item.matchupKey !== "string" || typeof item.headline !== "string" || typeof item.dek !== "string") {
      throw new Error("Recap card is missing matchupKey, headline, or dek.");
    }
    return { matchupKey: item.matchupKey, headline: item.headline, dek: item.dek };
  });
  const kicker = column.kicker == null ? null : column.kicker;
  if (kicker !== null && typeof kicker !== "string") throw new Error("Recap kicker was not a string.");
  return {
    column: {
      headline: column.headline,
      dek: column.dek,
      lede: column.lede,
      sections,
      kicker,
    },
    cards,
  };
}

function playersIn(brief: WeekBrief): LookupPlayer[] {
  const players: LookupPlayer[] = [];
  const seen = new Set<string>();
  for (const matchup of brief.matchups) {
    for (const side of [matchup.winner, matchup.loser]) {
      for (const player of side.lineup ?? []) add(players, seen, player.name, player.nflTeam, player.weekPoints);
      for (const performer of side.topPerformers) add(players, seen, performer.name, null, performer.points);
    }
  }
  return players;
}

function add(players: LookupPlayer[], seen: Set<string>, name: string, nflTeam: string | null, weekPoints: number | null) {
  const key = name.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  players.push({ name, nflTeam, weekPoints });
}
