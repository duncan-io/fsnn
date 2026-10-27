import { draftUntil, RECAP_GOAL, reviewWithOpenAi } from "../desk/review";
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

export type WrittenRecap = { ok: true; draft: RecapDraft } | { ok: false; draft: RecapDraft; notes: string[] };

export async function writeRecap(
  brief: WeekBrief,
  persona: Persona,
  complete: typeof fetch = fetch,
): Promise<WrittenRecap> {
  const result = await draftUntil({
    write: (notes) => requestDraft(brief, persona, notes, complete),
    facts: (drafted) => {
      const checked = validateRecap(brief, drafted.draft, drafted.snippets);
      return checked.ok ? [] : checked.errors;
    },
    edit: (drafted) =>
      reviewWithOpenAi({
        goal: RECAP_GOAL,
        brief: JSON.stringify(brief),
        copy: recapCopy(drafted.draft),
        complete,
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
