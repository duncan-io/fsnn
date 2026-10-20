import { closeDb } from "../src/db/client";
import { syncCurrentNfl } from "../src/yahoo/sync";

try {
  await syncCurrentNfl();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
