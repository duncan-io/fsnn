import type { RecapDraft, WeekBrief } from "./types";
import { validateRecap } from "./validate";
import { RECAP_STYLE } from "./voice";

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

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export async function writeRecap(
  brief: WeekBrief,
  complete: typeof fetch = fetch,
): Promise<RecapDraft> {
  const errors: string[] = [];
  let last = "Recap draft failed validation.";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let draft: RecapDraft;
    try {
      draft = await requestDraft(brief, errors, complete);
    } catch (error) {
      last = error instanceof Error ? error.message : "Recap draft could not be read.";
      errors.splice(0, errors.length, last);
      continue;
    }
    const result = validateRecap(brief, draft);
    if (result.ok) return draft;
    last = result.errors.join("\n");
    errors.splice(0, errors.length, ...result.errors);
  }
  throw new Error(last);
}

async function requestDraft(
  brief: WeekBrief,
  errors: string[],
  complete: typeof fetch,
): Promise<RecapDraft> {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!key || !model) {
    throw new Error("Set OPENAI_API_KEY and OPENAI_MODEL before writing a recap.");
  }
  const correction =
    errors.length > 0 ? `\n\nFix these problems and return the full JSON again:\n${errors.join("\n")}` : "";
  const response = await complete("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      messages: [
        { role: "system", content: RECAP_STYLE },
        { role: "user", content: `${JSON.stringify(brief)}${correction}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "weekly_recap", strict: true, schema: RECAP_SCHEMA },
      },
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI recap request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  const payload = (await response.json()) as ChatResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI recap response was empty.");
  return JSON.parse(content) as RecapDraft;
}
