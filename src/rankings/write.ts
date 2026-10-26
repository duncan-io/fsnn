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

export async function writeRankings(
  brief: RankingsBrief,
  persona: Persona,
  complete: typeof fetch = fetch,
): Promise<RankingsDraft> {
  const errors: string[] = [];
  let last = "Rankings draft failed validation.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let draft: { draft: RankingsDraft; snippets: string[] };
    try {
      draft = await requestDraft(brief, persona, errors, complete);
    } catch (error) {
      last = error instanceof Error ? error.message : "Rankings draft could not be read.";
      errors.splice(0, errors.length, last);
      continue;
    }
    const result = validateRankings(brief, draft.draft, draft.snippets);
    if (result.ok) return draft.draft;
    last = result.errors.join("\n");
    errors.splice(0, errors.length, ...result.errors);
  }
  throw new Error(last);
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
