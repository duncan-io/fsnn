import { draftUntil, RANKINGS_GOAL, reviewWithMinimax } from "../desk/review";
import { minimaxJsonDraft } from "../minimax/draft";
import type { Persona } from "../personas/staff";
import type { LookupPlayer } from "../search/lookup";
import type { RankingsBrief, RankingsDraft } from "./types";
import { validateRankings } from "./validate";
import { rankingsStyle } from "./voice";

export type WrittenRankings =
  | { ok: true; draft: RankingsDraft }
  | { ok: false; draft: RankingsDraft; notes: string[] };

export async function writeRankings(brief: RankingsBrief, persona: Persona): Promise<WrittenRankings> {
  const result = await draftUntil({
    write: (notes) => requestDraft(brief, persona, notes),
    facts: (drafted) => {
      const checked = validateRankings(brief, drafted.draft, drafted.snippets);
      return checked.ok ? [] : checked.errors;
    },
    edit: (drafted) =>
      reviewWithMinimax({
        goal: RANKINGS_GOAL,
        brief: JSON.stringify(brief),
        copy: rankingsCopy(drafted.draft),
      }),
  });
  return result.ok
    ? { ok: true, draft: result.draft.draft }
    : { ok: false, draft: result.draft.draft, notes: result.notes };
}

function rankingsCopy(draft: RankingsDraft): string {
  return [
    draft.headline,
    draft.dek,
    draft.lede,
    draft.kicker ?? "",
    ...draft.entries.flatMap((entry) => entry.paragraphs),
  ].join("\n");
}

async function requestDraft(
  brief: RankingsBrief,
  persona: Persona,
  errors: string[],
): Promise<{ draft: RankingsDraft; snippets: string[] }> {
  const correction =
    errors.length > 0 ? `\n\nFix these problems and return the full JSON again:\n${errors.join("\n")}` : "";
  const result = await minimaxJsonDraft({
    system: rankingsStyle(persona),
    user: `${JSON.stringify(brief)}${correction}`,
    players: playersIn(brief),
    week: brief.week,
    temperature: 0.8,
    parse: readRankingsDraft,
  });
  return { draft: result.value, snippets: result.snippets };
}

function readRankingsDraft(value: unknown): RankingsDraft {
  if (!value || typeof value !== "object") throw new Error("Rankings JSON was empty.");
  const row = value as {
    headline?: unknown;
    dek?: unknown;
    lede?: unknown;
    entries?: unknown;
    kicker?: unknown;
  };
  if (
    typeof row.headline !== "string" ||
    typeof row.dek !== "string" ||
    typeof row.lede !== "string" ||
    !Array.isArray(row.entries)
  ) {
    throw new Error("Rankings JSON is missing headline, dek, lede, or entries.");
  }
  const entries = row.entries.map((entry) => {
    if (!entry || typeof entry !== "object") throw new Error("Rankings entry was not an object.");
    const item = entry as { teamKey?: unknown; paragraphs?: unknown };
    if (typeof item.teamKey !== "string" || !Array.isArray(item.paragraphs)) {
      throw new Error("Rankings entry is missing teamKey or paragraphs.");
    }
    const paragraphs = item.paragraphs.filter((paragraph): paragraph is string => typeof paragraph === "string");
    return { teamKey: item.teamKey, paragraphs };
  });
  const kicker = row.kicker == null ? null : row.kicker;
  if (kicker !== null && typeof kicker !== "string") throw new Error("Rankings kicker was not a string.");
  return { headline: row.headline, dek: row.dek, lede: row.lede, entries, kicker };
}

function playersIn(brief: RankingsBrief): LookupPlayer[] {
  const players: LookupPlayer[] = [];
  const seen = new Set<string>();
  for (const team of brief.teams) {
    for (const player of team.lineup ?? []) {
      const key = player.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({ name: player.name, nflTeam: player.nflTeam, weekPoints: player.weekPoints });
    }
  }
  return players;
}
