import { createLookups, type LookupPlayer } from "./lookup";

type ToolCall = {
  id: string;
  function?: { name?: string; arguments?: string };
};

type ChatMessage = {
  role: string;
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ChatResponse = {
  choices?: Array<{ message?: ChatMessage }>;
};

export async function openAiJsonDraft<T>(args: {
  key: string;
  model: string;
  temperature: number;
  messages: ChatMessage[];
  schemaName: string;
  schema: object;
  players: LookupPlayer[];
  week: number;
  complete?: typeof fetch;
}): Promise<{ value: T; snippets: string[] }> {
  const complete = args.complete ?? fetch;
  const lookups = createLookups(args.players, args.week, complete);
  const messages: ChatMessage[] = [...args.messages];
  for (let turn = 0; turn < LOOKUP_TURNS; turn += 1) {
    const message = await post(complete, args, messages, true);
    const calls = message.tool_calls ?? [];
    if (calls.length === 0) break;
    messages.push(message);
    for (const call of calls) {
      const name = readPlayerName(call.function?.arguments);
      const content =
        call.function?.name === "lookup_player" && name
          ? await lookups.run(name)
          : "Use lookup_player with a rostered player name.";
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  messages.push({ role: "user", content: "Return the full JSON now." });
  const finalMessage = await post(complete, args, messages, false);
  const content = finalMessage.content;
  if (!content) throw new Error("The draft response was empty.");
  return { value: JSON.parse(content) as T, snippets: lookups.snippets };
}

const LOOKUP_TURNS = 4;

const LOOKUP_TOOL = {
  type: "function",
  function: {
    name: "lookup_player",
    description:
      "Look up how a rostered player performed in this NFL week when the sheet does not already explain the score.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["playerName"],
      properties: { playerName: { type: "string" } },
    },
  },
};

async function post(
  complete: typeof fetch,
  args: { key: string; model: string; temperature: number; schemaName: string; schema: object },
  messages: ChatMessage[],
  tools: boolean,
): Promise<ChatMessage> {
  const body: Record<string, unknown> = {
    model: args.model,
    temperature: args.temperature,
    messages,
  };
  if (tools) body.tools = [LOOKUP_TOOL];
  else {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: args.schemaName, strict: true, schema: args.schema },
    };
  }
  const response = await complete("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  const payload = (await response.json()) as ChatResponse;
  const message = payload.choices?.[0]?.message;
  if (!message) throw new Error("OpenAI response was empty.");
  return message;
}

function readPlayerName(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { playerName?: unknown };
    return typeof parsed.playerName === "string" ? parsed.playerName : null;
  } catch {
    return null;
  }
}
