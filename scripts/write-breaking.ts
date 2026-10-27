/**
 * Publish one breaking story from the synced league tables.
 *
 *   bun scripts/write-breaking.ts
 *
 * Run after a Yahoo sync, from this repo with .env.local loaded:
 *   bun scripts/yahoo-sync.ts && bun scripts/write-breaking.ts
 */
import { closeDb } from "../src/db/client";
import { describeBreaking, writeBreaking } from "../src/breaking/write";

try {
  const result = await writeBreaking();
  console.log(describeBreaking(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
