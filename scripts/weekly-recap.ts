/**
 * Publish the weekly league recap.
 *
 * Railway cron: Tuesdays at 10:00 America/New_York.
 * Command: bun run recap
 *
 * bun run recap --week 6 backfills that week.
 */
import { generateRecap } from "../src/backfill/week";
import { closeDb } from "../src/db/client";
import { latestCompletedWeek, listRecapLeagues } from "../src/recap/load";
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
  await syncCurrentNfl();
  const leagues = await listRecapLeagues();
  if (leagues.length === 0) {
    console.log("No leagues to recap.");
  }
  let published = 0;
  for (const league of leagues) {
    const label = league.name ?? league.leagueKey;
    const target = week ?? (await latestCompletedWeek(league.leagueKey));
    if (target == null) {
      console.log(`${label}: no completed week.`);
      continue;
    }
    const piece = await generateRecap(league.leagueKey, target);
    if (!piece) {
      console.log(`${label}: week ${target} is not final.`);
      continue;
    }
    console.log(piece.message);
    if (piece.outcome === "published") published += 1;
  }
  if (leagues.length > 0 && published === 0) console.log("No recap published.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
