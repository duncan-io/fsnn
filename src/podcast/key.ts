const AUDIO_KEY = /^podcasts\/[a-z0-9.]+(?:-[a-z0-9.]+)*\/week-[1-9]\d*\.mp3$/;

export function podcastAudioKey(leagueKey: string, week: number): string {
  const league = leagueKey
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!league || !Number.isInteger(week) || week < 1) {
    throw new Error("League and week cannot be used as an audio name.");
  }
  const key = `podcasts/${league}/week-${week}.mp3`;
  if (!isPodcastAudioKey(key)) throw new Error("League and week cannot be used as an audio name.");
  return key;
}

export function isPodcastAudioKey(key: string): boolean {
  return AUDIO_KEY.test(key);
}

export function audioKeyFromPath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }
  const key = segments.map(decode).join("/");
  return isPodcastAudioKey(key) ? key : null;
}

export function episodeSlug(leagueKey: string, week: number): string {
  const league = leagueKey
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `the-dig-week-${week}-${league || "league"}`;
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
