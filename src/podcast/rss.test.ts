import { describe, expect, test } from "bun:test";
import { podcastRss } from "./rss";

describe("podcastRss", () => {
  test("writes a Sports feed with an audio enclosure", () => {
    const xml = podcastRss(
      [
        {
          title: "The Dig, Week 6: Wolves pull away",
          description: "Wolves scored 120 & Bench scored 110.",
          slug: "the-dig-week-6-guild",
          publishedAt: new Date("2026-10-20T15:00:00.000Z"),
          audioUrl: "https://fsnn.example/podcast/audio/podcasts/guild/week-6.mp3",
          audioBytes: 1200,
          durationSeconds: 800,
        },
      ],
      "https://fsnn.example",
    );
    expect(xml).toContain("<title>The Dig with Greg and Jerry</title>");
    expect(xml).toContain("<itunes:author>Greg Pell and Jerry Crowe</itunes:author>");
    expect(xml).toContain('itunes:category text="Sports"');
    expect(xml).toContain('itunes:explicit>false');
    expect(xml).toContain('enclosure url="https://fsnn.example/podcast/audio/podcasts/guild/week-6.mp3" length="1200" type="audio/mpeg"');
    expect(xml).toContain("<itunes:duration>00:13:20</itunes:duration>");
    expect(xml).toContain("Wolves scored 120 &amp; Bench scored 110.");
  });
});
