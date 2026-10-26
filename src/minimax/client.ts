const URL = "https://api.minimax.io/v1/chat/completions";
const DEFAULT_MODEL = "MiniMax-M3";

export function requireMinimaxKey(): string {
  const key = process.env.MINIMAX_API_KEY?.trim();
  if (!key) throw new Error("Missing MINIMAX_API_KEY. Add it to .env.local (see .env.example).");
  return key;
}

export function sanitizeMinimax(body: string) {
  return body.replace(/sk-[a-zA-Z0-9_-]+/g, "[key]").replace(/\s+/g, " ").trim().slice(0, 180);
}

export async function complete(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const turn = await completeTurn(messages);
  if (!turn.content) throw new Error("MiniMax returned an empty column.");
  return turn.content;
}

export type MiniMaxToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type MiniMaxMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
};

export type CompleteOptions = {
  maxTokens?: number;
  temperature?: number;
};

export async function completeTurn(
  messages: MiniMaxMessage[],
  tools?: unknown[],
  options?: CompleteOptions,
): Promise<{ content: string; toolCalls: MiniMaxToolCall[] }> {
  const key = requireMinimaxKey();
  const model = process.env.MINIMAX_MODEL?.trim() || DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_completion_tokens: options?.maxTokens ?? 1200,
  };
  if (tools) body.tools = tools;
  const response = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax request failed (${response.status}): ${sanitizeMinimax(raw)}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("MiniMax returned a response that was not JSON.");
  }
  return readTurn(payload);
}

function readTurn(payload: unknown): { content: string; toolCalls: MiniMaxToolCall[] } {
  if (!payload || typeof payload !== "object") return { content: "", toolCalls: [] };
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return { content: "", toolCalls: [] };
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return { content: "", toolCalls: [] };
  const row = message as { content?: unknown; tool_calls?: unknown };
  const content = typeof row.content === "string" ? row.content.trim() : "";
  const toolCalls = Array.isArray(row.tool_calls)
    ? row.tool_calls.flatMap((call) => {
        if (!call || typeof call !== "object") return [];
        const item = call as { id?: unknown; function?: { name?: unknown; arguments?: unknown } };
        if (typeof item.id !== "string" || !item.function || typeof item.function.name !== "string") return [];
        const args = item.function.arguments;
        return [{ id: item.id, name: item.function.name, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) }];
      })
    : [];
  return { content, toolCalls };
}

