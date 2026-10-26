import { hostNames, SHOW } from "./show";

export type RssEpisode = {
  title: string;
  description: string;
  slug: string;
  publishedAt: Date;
  audioUrl: string;
  audioBytes: number;
  durationSeconds: number;
};

export function podcastRss(episodes: RssEpisode[], site: string): string {
  const origin = site.replace(/\/$/, "");
  const cover = `${origin}/podcast-cover.jpg`;
  const page = `${origin}/podcast`;
  const items = episodes
    .map((episode) => {
      const link = `${page}/${episode.slug}`;
      return [
        "    <item>",
        `      <title>${xml(episode.title)}</title>`,
        `      <description>${xml(episode.description)}</description>`,
        `      <itunes:summary>${xml(episode.description)}</itunes:summary>`,
        `      <itunes:duration>${duration(episode.durationSeconds)}</itunes:duration>`,
        `      <pubDate>${episode.publishedAt.toUTCString()}</pubDate>`,
        `      <link>${xml(link)}</link>`,
        `      <guid isPermaLink="true">${xml(link)}</guid>`,
        `      <enclosure url="${xml(episode.audioUrl)}" length="${episode.audioBytes}" type="audio/mpeg"/>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
    "  <channel>",
    `    <title>${xml(SHOW.title)}</title>`,
    `    <link>${xml(page)}</link>`,
    `    <description>${xml(SHOW.summary)}</description>`,
    "    <language>en-us</language>",
    `    <itunes:author>${xml(hostNames())}</itunes:author>`,
    `    <itunes:summary>${xml(SHOW.summary)}</itunes:summary>`,
    "    <itunes:explicit>false</itunes:explicit>",
    '    <itunes:category text="Sports"/>',
    `    <itunes:image href="${xml(cover)}"/>`,
    "    <image>",
    `      <url>${xml(cover)}</url>`,
    `      <title>${xml(SHOW.title)}</title>`,
    `      <link>${xml(page)}</link>`,
    "    </image>",
    items,
    "  </channel>",
    "</rss>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function clockDuration(seconds: number): string {
  return duration(Math.max(0, Math.round(seconds)));
}

function duration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remain = safe % 60;
  return [hours, minutes, remain].map((part) => String(part).padStart(2, "0")).join(":");
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
