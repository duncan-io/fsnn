import { closeDb } from "../src/db/client";
import { authorizeYahoo } from "../src/yahoo/auth";

try {
  await authorizeYahoo();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
