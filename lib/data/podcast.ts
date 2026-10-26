import { cacheLife, cacheTag, io } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { podcastEpisodes } from "@/src/db/schema";
import { isPodcastAudioKey } from "@/src/podcast/key";
import type { PodcastScript } from "@/src/podcast/types";

export type StoredEpisode = {
  id: string;
  slug: string;
  title: string;
  description: string;
  week: number;
  durationSeconds: number;
  audioBytes: number;
  publishedAt: string;
  audioPath: string;
  script: PodcastScript;
};

export async function getPodcastEpisodes(): Promise<StoredEpisode[]> {
  if (!process.env.DATABASE_URL) return [];
  await io();
  try {
    return await readEpisodes();
  } catch (error) {
    if (isUnreachableDatabase(error)) return [];
    throw error;
  }
}

export async function getPodcastEpisode(slug: string): Promise<StoredEpisode | null> {
  if (!process.env.DATABASE_URL) return null;
  await io();
  try {
    return await readEpisode(slug);
  } catch (error) {
    if (isUnreachableDatabase(error)) return null;
    throw error;
  }
}

async function readEpisodes(): Promise<StoredEpisode[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("podcast");
  const db = getDb();
  const rows = await db.select().from(podcastEpisodes).orderBy(desc(podcastEpisodes.week), desc(podcastEpisodes.publishedAt));
  return rows.flatMap((row) => {
    const episode = toEpisode(row);
    return episode ? [episode] : [];
  });
}

async function readEpisode(slug: string): Promise<StoredEpisode | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("podcast");
  const db = getDb();
  const [row] = await db.select().from(podcastEpisodes).where(eq(podcastEpisodes.slug, slug)).limit(1);
  return row ? toEpisode(row) : null;
}

function toEpisode(row: typeof podcastEpisodes.$inferSelect): StoredEpisode | null {
  const script = asScript(row.script);
  if (!script || !isPodcastAudioKey(row.audioKey)) return null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    week: row.week,
    durationSeconds: row.durationSeconds,
    audioBytes: row.audioBytes,
    publishedAt: row.publishedAt.toISOString(),
    audioPath: `/podcast/audio/${row.audioKey}`,
    script,
  };
}

function asScript(value: unknown): PodcastScript | null {
  if (!value || typeof value !== "object") return null;
  const script = value as PodcastScript;
  if (typeof script.title !== "string" || typeof script.description !== "string") return null;
  if (!script.outline || !Array.isArray(script.outline.sections) || !Array.isArray(script.segments)) return null;
  if (script.segments.some((segment) => !segment || typeof segment.id !== "string" || !Array.isArray(segment.lines))) {
    return null;
  }
  return script;
}

const unreachableCodes = new Set([
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

function isUnreachableDatabase(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string" && unreachableCodes.has(current.code)) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
