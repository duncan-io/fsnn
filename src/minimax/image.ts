import { requireMinimaxKey, sanitizeMinimax } from "./client";

const URL = "https://api.minimax.io/v1/image_generation";
const DEFAULT_MODEL = "image-01";
const PROMPT_LIMIT = 1500;

const INSTRUCTIONS = [
  "Editorial illustration for a fantasy football news site.",
  "A wide scene suggested by the story, painted in a contemporary sports-magazine style.",
  "No readable text, no logos, no trademarks, and no likeness of a real athlete.",
].join(" ");

export function illustrationPrompt(headline: string, dek: string): string {
  const room = PROMPT_LIMIT - INSTRUCTIONS.length - 1;
  const story = `${headline} ${dek}`.replace(/\s+/g, " ").trim().slice(0, Math.max(0, room));
  return story ? `${INSTRUCTIONS} ${story}` : INSTRUCTIONS;
}

export async function generateIllustration(headline: string, dek: string): Promise<Uint8Array> {
  return requestImage(illustrationPrompt(headline, dek), "16:9");
}

export async function generateSquare(prompt: string): Promise<Uint8Array> {
  return requestImage(prompt.slice(0, PROMPT_LIMIT), "1:1");
}

async function requestImage(prompt: string, aspectRatio: string): Promise<Uint8Array> {
  const model = process.env.MINIMAX_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
  const response = await fetch(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireMinimaxKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      aspect_ratio: aspectRatio,
      response_format: "base64",
      n: 1,
      aigc_watermark: false,
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax image request failed (${response.status}): ${sanitizeMinimax(raw)}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("MiniMax image response was not JSON.");
  }
  return decodeIllustration(readIllustration(payload));
}

export function readIllustration(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("MiniMax image response was empty.");
  const base = (payload as { base_resp?: { status_code?: unknown; status_msg?: unknown } }).base_resp;
  if (base && typeof base.status_code === "number" && base.status_code !== 0) {
    const message = typeof base.status_msg === "string" ? sanitizeMinimax(base.status_msg) : "request failed";
    throw new Error(`MiniMax image request failed: ${message}`);
  }
  const data = (payload as { data?: unknown }).data;
  const images = data && typeof data === "object" ? (data as { image_base64?: unknown }).image_base64 : undefined;
  const encoded = Array.isArray(images)
    ? images.find((item): item is string => typeof item === "string" && item.trim().length > 0)
    : typeof images === "string"
      ? images
      : undefined;
  if (!encoded?.trim()) throw new Error("MiniMax image response had no picture.");
  return encoded.trim();
}

function decodeIllustration(encoded: string): Uint8Array {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0) throw new Error("MiniMax image response had no picture.");
  return bytes;
}
