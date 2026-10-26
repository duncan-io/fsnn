import { describe, expect, test } from "bun:test";
import { createLookups, findPlayer, lookupQuery } from "./lookup";
import { search } from "./serper";

describe("serper", () => {
  test("posts the query with the API key", async () => {
    const previous = process.env.SERPER_API_KEY;
    process.env.SERPER_API_KEY = "test-key";
    try {
      let header: string | null = null;
      let body = "";
      const hits = await search('"Star Back" GB NFL week 6 stats', async (_url, init) => {
        header = new Headers(init?.headers).get("X-API-KEY");
        body = String(init?.body);
        return Response.json({ organic: [{ title: "Star Back", link: "https://example.com", snippet: "8 catches" }] });
      });
      expect(header).toBe("test-key");
      expect(JSON.parse(body)).toEqual({ q: '"Star Back" GB NFL week 6 stats' });
      expect(hits[0]?.snippet).toBe("8 catches");
    } finally {
      if (previous == null) delete process.env.SERPER_API_KEY;
      else process.env.SERPER_API_KEY = previous;
    }
  });
});

describe("lookup_player", () => {
  const players = [{ name: "Star Back", nflTeam: "GB", weekPoints: 28.4 }];

  test("builds the query from the rostered player", () => {
    expect(lookupQuery(players[0], 6)).toBe('"Star Back" GB NFL week 6 stats');
    expect(findPlayer("Nobody", players)).toBeNull();
  });

  test("says search is unavailable when the key is missing", async () => {
    const previous = process.env.SERPER_API_KEY;
    delete process.env.SERPER_API_KEY;
    try {
      const lookups = createLookups(players, 6, async () => {
        throw new Error("fetch should not run");
      });
      expect(await lookups.run("Star Back")).toBe("Search is unavailable. Use the sheet.");
      expect(lookups.snippets).toEqual([]);
    } finally {
      if (previous == null) delete process.env.SERPER_API_KEY;
      else process.env.SERPER_API_KEY = previous;
    }
  });
});
