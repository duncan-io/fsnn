import { closeDb } from "../src/db/client";
import { YahooClient } from "../src/yahoo/client";
import { ingest } from "../src/yahoo/ingest";

const pathArg = process.argv.slice(2).join(" ").trim();

try {
  if (!pathArg) {
    throw new Error(
      'Usage: bun run yahoo:get -- "/league/461.l.123/scoreboard;week=3"\nQuote paths that contain ";".',
    );
  }
  const response = await new YahooClient().get(pathArg);
  const known = await ingest(response.path, response.flat);
  console.log(JSON.stringify(response.flat, null, 2));
  console.error(
    known
      ? `Stored ${response.path} and updated the normalized tables.`
      : `Stored ${response.path}. This path is kept in yahoo_resources.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
