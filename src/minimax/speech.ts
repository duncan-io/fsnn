import { requireMinimaxKey, sanitizeMinimax } from "./client";

const URL = "https://api.minimax.io/v1/t2a_v2";
const DEFAULT_MODEL = "speech-2.6-hd";

export type SpeechClip = {
  bytes: Uint8Array;
  durationMs: number;
};

export function voiceFor(speaker: "jerry" | "greg"): string {
  if (speaker === "jerry") return process.env.MINIMAX_VOICE_JERRY?.trim() || "English_Persuasive_Man";
  return process.env.MINIMAX_VOICE_GREG?.trim() || "English_Insightful_Speaker";
}

export async function synthesize(text: string, voiceId: string, complete: typeof fetch = fetch): Promise<SpeechClip> {
  const model = process.env.MINIMAX_SPEECH_MODEL?.trim() || DEFAULT_MODEL;
  const response = await complete(URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireMinimaxKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      text,
      stream: false,
      language_boost: "English",
      output_format: "hex",
      voice_setting: { voice_id: voiceId, speed: 1, vol: 1, pitch: 0 },
      audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
    }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax speech request failed (${response.status}): ${sanitizeMinimax(raw)}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("MiniMax speech response was not JSON.");
  }
  return readSpeech(payload);
}

export function readSpeech(payload: unknown): SpeechClip {
  if (!payload || typeof payload !== "object") throw new Error("MiniMax speech response was empty.");
  const base = (payload as { base_resp?: { status_code?: unknown; status_msg?: unknown } }).base_resp;
  if (base && typeof base.status_code === "number" && base.status_code !== 0) {
    const message = typeof base.status_msg === "string" ? sanitizeMinimax(base.status_msg) : "request failed";
    throw new Error(`MiniMax speech request failed: ${message}`);
  }
  const data = (payload as { data?: { audio?: unknown } }).data;
  const encoded = data && typeof data.audio === "string" ? data.audio.trim() : "";
  if (!encoded) throw new Error("MiniMax speech response had no audio.");
  const extra = (payload as { extra_info?: { audio_length?: unknown } }).extra_info;
  const durationMs = extra && typeof extra.audio_length === "number" ? extra.audio_length : null;
  if (durationMs == null || durationMs < 0) throw new Error("MiniMax speech response had no duration.");
  return { bytes: decodeHex(encoded), durationMs };
}

function decodeHex(encoded: string): Uint8Array {
  if (encoded.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(encoded)) {
    throw new Error("MiniMax speech response had no audio.");
  }
  const bytes = Buffer.from(encoded, "hex");
  if (bytes.length === 0) throw new Error("MiniMax speech response had no audio.");
  return bytes;
}
