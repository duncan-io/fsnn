import { synthesize, voiceFor, type SpeechClip } from "../minimax/speech";
import type { PodcastScript } from "./types";

const MIN_SECONDS = 9 * 60;
const MAX_SECONDS = 16 * 60;
const POOL = 3;

export function lineForSpeech(text: string, pauseBefore: boolean): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!pauseBefore) return clean;
  const splitAt = clean.indexOf(" ");
  if (splitAt < 1) return clean;
  return `${clean.slice(0, splitAt)}<#0.3#>${clean.slice(splitAt)}`;
}

export function stripId3(bytes: Uint8Array): Uint8Array {
  let start = 0;
  let end = bytes.length;
  if (end >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    start = Math.min(end, 10 + size + ((bytes[5] & 0x10) === 0x10 ? 10 : 0));
  }
  if (end - start >= 128 && bytes[end - 128] === 0x54 && bytes[end - 127] === 0x41 && bytes[end - 126] === 0x47) {
    end -= 128;
  }
  return bytes.slice(start, end);
}

export function joinMp3(clips: Uint8Array[]): Uint8Array {
  const parts = clips.map((clip) => stripId3(clip));
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export async function renderEpisode(
  script: PodcastScript,
  speak: typeof synthesize = synthesize,
): Promise<{ bytes: Uint8Array; durationSeconds: number }> {
  let previous: string | null = null;
  const jobs = script.segments.flatMap((segment) =>
    segment.lines.map((line) => {
      const pause = previous !== null && previous !== line.speaker;
      previous = line.speaker;
      return { text: lineForSpeech(line.text, pause), voiceId: voiceFor(line.speaker) };
    }),
  );
  const clips = await mapPool(jobs, POOL, (job) => speakOnce(job.text, job.voiceId, speak));
  const durationMs = clips.reduce((sum, clip) => sum + clip.durationMs, 0);
  const durationSeconds = Math.round(durationMs / 1000);
  if (durationSeconds < MIN_SECONDS || durationSeconds > MAX_SECONDS) {
    throw new Error(`Episode is ${durationSeconds} seconds, outside 9 to 16 minutes.`);
  }
  return { bytes: joinMp3(clips.map((clip) => clip.bytes)), durationSeconds };
}

async function speakOnce(text: string, voiceId: string, speak: typeof synthesize): Promise<SpeechClip> {
  try {
    return await speak(text, voiceId);
  } catch {
    return speak(text, voiceId);
  }
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await worker(item);
    }
  });
  await Promise.all(runners);
  return results;
}
