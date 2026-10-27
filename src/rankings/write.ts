import { draftUntil, RANKINGS_GOAL, reviewWithOpenAi } from "../desk/review";
import type { Persona } from "../personas/staff";
import type { LookupPlayer } from "../search/lookup";
import { openAiJsonDraft } from "../search/openai";
import type { RankingsBrief, RankingsDraft } from "./types";
import { validateRankings } from "./validate";
import { rankingsStyle } from "./voice";

const RANKINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "dek", "lede", "entries", "kicker"],
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    lede: { type: "string" },
    kicker: { anyOf: [{ type: "string" }, { type: "null" }] },
    entries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["teamKey", "paragraphs"],
        properties: {
          teamKey: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export type WrittenRankings =
  | { ok: true; draft: RankingsDraft }
  | { ok: false; draft: RankingsDraft; notes: string[] };

export async function writeRankings(
  brief: RankingsBrief,
  persona: Persona,
  complete: typeof fetch = fetch,
): Promise<WrittenRankings> {
  const result = await draftUntil({
    write: (notes) => requestDraft(brief, persona, notes, complete),
    facts: (drafted) => {
      const checked = validateRankings(brief, drafted.draft, drafted.snippets);
      return checked.ok ? [] : checked.errors;
    },
    edit: (drafted) =>
      reviewWithOpenAi({
        goal: RANKINGS_GOAL,
        brief: JSON.stringify(brief),
        copy: rankingsCopy(drafted.draft),
        complete,
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
  complete: typeof fetch,
): Promise<{ draft: RankingsDraft; snippets: string[] }> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key || !model) {
    throw new Error("Set OPENAI_API_KEY and OPENAI_MODEL before writing power rankings.");
  }
  const correction =
    errors.length > 0 ? `\n\nFix these problems and return the full JSON again:\n${errors.join("\n")}` : "";
  const result = await openAiJsonDraft<RankingsDraft>({
    key,
    model,
    temperature: 0.8,
    messages: [
      { role: "system", content: rankingsStyle(persona) },
      { role: "user", content: `${JSON.stringify(brief)}${correction}` },
    ],
    schemaName: "power_rankings",
    schema: RANKINGS_SCHEMA,
    players: playersIn(brief),
    week: brief.week,
    complete,
  });
  return { draft: result.value, snippets: result.snippets };
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
