const URL = "https://api.minimax.io/v1/chat/completions";
const DEFAULT_MODEL = "MiniMax-M3";

export async function complete(messages: { role: "system" | "user"; content: string }[]): Promise<string> {
  const key = process.env.MINIMAX_API_KEY?.trim();
  if (!key) throw new Error("Missing MINIMAX_API_KEY. Add it to .env.local (see .env.example).");
  const model = process.env.MINIMAX_MODEL?.trim() || DEFAULT_MODEL;
  const response = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_completion_tokens: 1200,
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax request failed (${response.status}): ${sanitize(raw)}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("MiniMax returned a response that was not JSON.");
  }
  const content = readContent(payload);
  if (!content) throw new Error("MiniMax returned an empty column.");
  return content;
}

function readContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content.trim() : "";
}

function sanitize(body: string) {
  return body.replace(/sk-[a-zA-Z0-9_-]+/g, "[key]").replace(/\s+/g, " ").trim().slice(0, 180);
}
