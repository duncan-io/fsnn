import type { Persona } from "../personas/staff";
import { openAiJsonDraft } from "../search/openai";
import type { LookupPlayer } from "../search/lookup";
import type { RecapDraft, WeekBrief } from "./types";
import { validateRecap } from "./validate";
import { recapStyle } from "./voice";

const RECAP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["column", "cards"],
  properties: {
    column: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "dek", "lede", "sections", "kicker"],
      properties: {
        headline: { type: "string" },
        dek: { type: "string" },
        lede: { type: "string" },
        kicker: { anyOf: [{ type: "string" }, { type: "null" }] },
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["matchupKey", "heading", "paragraphs"],
            properties: {
              matchupKey: { type: "string" },
              heading: { type: "string" },
              paragraphs: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["matchupKey", "headline", "dek"],
        properties: {
          matchupKey: { type: "string" },
          headline: { type: "string" },
          dek: { type: "string" },
        },
      },
    },
  },
} as const;

export async function writeRecap(
  brief: WeekBrief,
  persona: Persona,
  complete: typeof fetch = fetch,
): Promise<RecapDraft> {
  const errors: string[] = [];
  let last = "Recap draft failed validation.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let draft: { draft: RecapDraft; snippets: string[] };
    try {
      draft = await requestDraft(brief, persona, errors, complete);
    } catch (error) {
      last = error instanceof Error ? error.message : "Recap draft could not be read.";
      errors.splice(0, errors.length, last);
      continue;
    }
    const result = validateRecap(brief, draft.draft, draft.snippets);
    if (result.ok) return draft.draft;
    last = result.errors.join("\n");
    errors.splice(0, errors.length, ...result.errors);
  }
  throw new Error(last);
}

async function requestDraft(
  brief: WeekBrief,
  persona: Persona,
  errors: string[],
  complete: typeof fetch,
): Promise<{ draft: RecapDraft; snippets: string[] }> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key || !model) {
    throw new Error("Set OPENAI_API_KEY and OPENAI_MODEL before writing a recap.");
  }
  const correction =
    errors.length > 0 ? `\n\nFix these problems and return the full JSON again:\n${errors.join("\n")}` : "";
  const result = await openAiJsonDraft<RecapDraft>({
    key,
    model,
    temperature: 0.8,
    messages: [
      { role: "system", content: recapStyle(persona) },
      { role: "user", content: `${JSON.stringify(brief)}${correction}` },
    ],
    schemaName: "weekly_recap",
    schema: RECAP_SCHEMA,
    players: playersIn(brief),
    week: brief.week,
    complete,
  });
  return { draft: result.value, snippets: result.snippets };
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
