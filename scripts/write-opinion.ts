/**
 * Write and publish one opinion column from the synced league tables.
 *
 *   bun scripts/write-opinion.ts results
 *   bun scripts/write-opinion.ts waivers
 *
 * Cron, after a sync, from this repo with .env.local loaded:
 *   0 9 * * 2  cd /path/to/fantasy-newsroom && bun scripts/yahoo-sync.ts && bun scripts/write-opinion.ts results
 *   0 9 * * 5  cd /path/to/fantasy-newsroom && bun scripts/yahoo-sync.ts && bun scripts/write-opinion.ts waivers
 */
import { closeDb } from "../src/db/client";
import { describeWrite, writeOpinion } from "../src/opinion/write";
import type { OpinionDesk } from "../src/opinion/types";

const desk = process.argv[2];

try {
  if (desk !== "results" && desk !== "waivers") {
    throw new Error("Usage: bun scripts/write-opinion.ts results|waivers");
  }
  const result = await writeOpinion(desk as OpinionDesk);
  console.log(describeWrite(desk, result));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
