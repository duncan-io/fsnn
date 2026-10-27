import { completeTurn } from "../minimax/client";
import { extractJson } from "../minimax/json";

export const REWRITES = 3;

const REVIEW_TEMPERATURE = 0.2;

export const RECAP_GOAL = [
  "This is a news report of the week.",
  "The headline carries a true score or margin and a verb with some bite.",
  "The dek says what the result did to the standings.",
  "When a matchup sheet includes leads, that matchup opens from one of those leads.",
  "Heat stays on the result or the roster decision.",
].join(" ");

export const RANKINGS_GOAL = [
  "The rank order is already decided.",
  "The headline names the team at rank 1 and the week.",
  "The dek says who moved, or where this order disagrees with the official standings.",
  "Each entry explains that rank from scoring, the roster, and the schedule.",
].join(" ");

export const OPINION_GOAL = [
  "The column argues the claim in the brief.",
  "One sentence states the counter-evidence.",
  "The body is three or four short paragraphs.",
  "It does not wander into a recap of the whole week.",
].join(" ");

const FLAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["flags"],
  properties: {
    flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["reason"],
        properties: { reason: { type: "string" } },
      },
    },
  },
} as const;

export type DraftResult<T> = { ok: true; draft: T } | { ok: false; draft: T; notes: string[] };

export function editorStyle(goal: string): string {
  return [
    "You audit one piece. You do not rewrite it.",
    goal,
    "Flag the piece only when it misses that goal.",
    "Leave voice, jokes, and sentence rhythm alone when the goal is met.",
    "Do not invent facts.",
    'Return JSON only: {"flags":[{"reason":"..."}]}. Return {"flags":[]} when the piece meets the goal.',
  ].join(" ");
}

export function readFlags(value: unknown): string[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { flags?: unknown }).flags)) {
    return ["Editor review was not JSON."];
  }
  const flags = (value as { flags: unknown[] }).flags;
  const reasons = flags.flatMap((flag) => {
    if (!flag || typeof flag !== "object") return [];
    const reason = (flag as { reason?: unknown }).reason;
    if (typeof reason !== "string" || !reason.trim()) return [];
    return [reason.trim()];
  });
  if (flags.length > 0 && reasons.length === 0) return ["Editor review was not JSON."];
  return reasons;
}

export async function draftUntil<T>(args: {
  write: (notes: string[]) => Promise<T>;
  facts: (draft: T) => string[];
  edit: (draft: T) => Promise<string[]>;
}): Promise<DraftResult<T>> {
  const attempts = REWRITES + 1;
  let notes: string[] = [];
  let held: { draft: T; notes: string[] } | null = null;
  let lastUnread = "Draft could not be read.";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let draft: T;
    try {
      draft = await args.write(notes);
    } catch (error) {
      lastUnread = error instanceof Error ? error.message : "Draft could not be read.";
      notes = [lastUnread];
      continue;
    }
    const factErrors = args.facts(draft);
    if (factErrors.length > 0) {
      notes = factErrors;
      held = { draft, notes };
      continue;
    }
    let flags: string[];
    try {
      flags = await args.edit(draft);
    } catch (error) {
      flags = [error instanceof Error ? error.message : "Editor review failed."];
    }
    if (flags.length === 0) return { ok: true, draft };
    notes = flags;
    held = { draft, notes };
  }
  if (!held) throw new Error(lastUnread);
  return { ok: false, draft: held.draft, notes: held.notes };
}

export async function reviewWithOpenAi(args: {
  goal: string;
  brief: string;
  copy: string;
  complete?: typeof fetch;
}): Promise<string[]> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key || !model) {
    throw new Error("Set OPENAI_API_KEY and OPENAI_MODEL before reviewing a draft.");
  }
  const complete = args.complete ?? fetch;
  const response = await complete("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: REVIEW_TEMPERATURE,
      messages: [
        { role: "system", content: editorStyle(args.goal) },
        { role: "user", content: JSON.stringify({ brief: args.brief, copy: args.copy }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "editor_flags", strict: true, schema: FLAG_SCHEMA },
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return ["Editor review was empty."];
  try {
    return readFlags(JSON.parse(content));
  } catch {
    return ["Editor review was not JSON."];
  }
}

export async function reviewWithMinimax(args: {
  goal: string;
  brief: string;
  copy: string;
  turn?: typeof completeTurn;
}): Promise<string[]> {
  const turn = args.turn ?? completeTurn;
  const result = await turn(
    [
      { role: "system", content: editorStyle(args.goal) },
      { role: "user", content: JSON.stringify({ brief: args.brief, copy: args.copy }) },
    ],
    undefined,
    { maxTokens: 800, temperature: REVIEW_TEMPERATURE },
  );
  if (!result.content) return ["Editor review was empty."];
  try {
    return readFlags(extractJson(result.content));
  } catch {
    return ["Editor review was not JSON."];
  }
}
