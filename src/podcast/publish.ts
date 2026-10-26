import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { podcastEpisodes } from "../db/schema";
import type { WeekBrief } from "../recap/types";
import { episodeSlug, podcastAudioKey } from "./key";
import type { PreviewBrief } from "./preview";
import { SHOW } from "./show";
import type { PodcastScript } from "./types";

export async function findPodcastEpisode(leagueKey: string, week: number) {
  const db = getDb();
  const [row] = await db
    .select({ slug: podcastEpisodes.slug })
    .from(podcastEpisodes)
    .where(and(eq(podcastEpisodes.leagueKey, leagueKey), eq(podcastEpisodes.week, week)))
    .limit(1);
  return row ?? null;
}

export async function saveEpisode(args: {
  recap: WeekBrief;
  preview: PreviewBrief | null;
  script: PodcastScript;
  audioKey: string;
  durationSeconds: number;
  audioBytes: number;
}) {
  const db = getDb();
  const row = {
    leagueKey: args.recap.leagueKey,
    week: args.recap.week,
    slug: episodeSlug(args.recap.leagueKey, args.recap.week),
    title: args.script.title,
    description: args.script.description,
    script: args.script,
    brief: { recap: args.recap, preview: args.preview },
    audioKey: args.audioKey,
    durationSeconds: args.durationSeconds,
    audioBytes: args.audioBytes,
    hosts: [...SHOW.hosts],
    publishedAt: new Date(),
  };
  await db
    .insert(podcastEpisodes)
    .values(row)
    .onConflictDoUpdate({
      target: [podcastEpisodes.leagueKey, podcastEpisodes.week],
      set: {
        slug: row.slug,
        title: row.title,
        description: row.description,
        script: row.script,
        brief: row.brief,
        audioKey: row.audioKey,
        durationSeconds: row.durationSeconds,
        audioBytes: row.audioBytes,
        hosts: row.hosts,
        publishedAt: row.publishedAt,
      },
    });
}

export function episodeAudioKey(leagueKey: string, week: number): string {
  return podcastAudioKey(leagueKey, week);
}
