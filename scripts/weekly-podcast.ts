/**
 * Publish The Dig with Greg and Jerry.
 *
 * Railway cron: Tuesdays at 11:00 America/New_York.
 * Command: bun run podcast
 *
 * bun run podcast --week 6 backfills that week.
 * bun run podcast --force replaces an episode that is already published.
 */
import { closeDb } from "../src/db/client";
import { episodeAudioKey, findPodcastEpisode, saveEpisode } from "../src/podcast/publish";
import { loadPreviewBrief } from "../src/podcast/preview";
import { renderEpisode } from "../src/podcast/render";
import { writeScript } from "../src/podcast/write";
import { latestCompletedWeek, listRecapLeagues, loadWeekBrief } from "../src/recap/load";
import { putObject } from "../src/storage/bucket";
import { syncCurrentNfl } from "../src/yahoo/sync";

function requestedWeek(argv: string[]): number | undefined {
  const index = argv.indexOf("--week");
  if (index === -1) return undefined;
  const value = Number(argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Pass --week as a positive integer, for example --week 6.");
  }
  return value;
}

try {
  const week = requestedWeek(process.argv);
  const force = process.argv.includes("--force");
  await syncCurrentNfl();
  const leagues = await listRecapLeagues();
  if (leagues.length === 0) console.log("No leagues for the show.");
  let published = 0;
  for (const league of leagues) {
    const label = league.name ?? league.leagueKey;
    const target = week ?? (await latestCompletedWeek(league.leagueKey));
    if (target == null) {
      console.log(`${label}: no completed week.`);
      continue;
    }
    const existing = await findPodcastEpisode(league.leagueKey, target);
    if (existing && !force) {
      console.log(`${label}: week ${target} already has an episode.`);
      continue;
    }
    const brief = await loadWeekBrief(league.leagueKey, target);
    if (!brief) {
      console.log(`${label}: week ${target} is not final.`);
      continue;
    }
    const preview = await loadPreviewBrief(league.leagueKey, target);
    const script = await writeScript(brief, preview);
    const audio = await renderEpisode(script);
    const audioKey = episodeAudioKey(brief.leagueKey, brief.week);
    await putObject(audioKey, audio.bytes, "audio/mpeg");
    await saveEpisode({
      recap: brief,
      preview,
      script,
      audioKey,
      durationSeconds: audio.durationSeconds,
      audioBytes: audio.bytes.length,
    });
    published += 1;
    console.log(`Published The Dig week ${target} for ${brief.leagueName}.`);
  }
  if (leagues.length > 0 && published === 0) console.log("No episode published.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
