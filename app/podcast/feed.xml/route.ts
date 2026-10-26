import { connection } from "next/server";
import { getPodcastEpisodes } from "@/lib/data/podcast";
import { podcastRss, type RssEpisode } from "@/src/podcast/rss";

export async function GET() {
  await connection();
  const episodes = await getPodcastEpisodes();
  const origin = siteOrigin();
  const feed: RssEpisode[] = episodes.map((episode) => ({
    title: episode.title,
    description: episode.description,
    slug: episode.slug,
    publishedAt: new Date(episode.publishedAt),
    audioUrl: `${origin}${episode.audioPath}`,
    audioBytes: episode.audioBytes,
    durationSeconds: episode.durationSeconds,
  }));
  return new Response(podcastRss(feed, origin), {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function siteOrigin(): string {
  const value = process.env.SITE_URL?.trim() || "http://127.0.0.1:3000";
  return value.replace(/\/$/, "");
}
