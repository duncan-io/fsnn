/**
 * Illustrate stored recaps, opinion columns, and breaking stories that do not have an image yet.
 *
 * bun run images
 */
import { closeDb } from "../src/db/client";
import { illustrateStored } from "../src/images/illustrate";
import { listMissingIllustrations } from "../src/images/store";

try {
  const missing = await listMissingIllustrations();
  if (missing.length === 0) {
    console.log("Every stored story already has an image.");
  }
  let illustrated = 0;
  for (const story of missing) {
    if (await illustrateStored(story)) illustrated += 1;
  }
  if (missing.length > 0) {
    console.log(`Illustrated ${illustrated} of ${missing.length}.`);
    if (illustrated !== missing.length) process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
