import { search, serperKey, type SearchHit } from "./serper";

export const LOOKUP_LIMIT = 4;

export type LookupPlayer = {
  name: string;
  nflTeam: string | null;
  weekPoints: number | null;
};

export function lookupQuery(player: LookupPlayer, week: number): string {
  const team = player.nflTeam ? ` ${player.nflTeam}` : "";
  return `"${player.name}"${team} NFL week ${week} stats`;
}

export function findPlayer(name: string, players: LookupPlayer[]): LookupPlayer | null {
  const needle = normalize(name);
  if (!needle) return null;
  const exact = players.find((player) => normalize(player.name) === needle);
  if (exact) return exact;
  const partial = players.filter((player) => {
    const haystack = normalize(player.name);
    return haystack.includes(needle) || needle.includes(haystack);
  });
  return partial.length === 1 ? partial[0] : null;
}

export function formatHits(hits: SearchHit[]): string {
  if (hits.length === 0) return "No results.";
  return hits
    .slice(0, 5)
    .map((hit) => `${hit.title}\n${hit.snippet}`)
    .join("\n\n");
}

export function createLookups(players: LookupPlayer[], week: number, complete: typeof fetch = fetch) {
  const snippets: string[] = [];
  let used = 0;
  return {
    snippets,
    async run(playerName: string): Promise<string> {
      if (used >= LOOKUP_LIMIT) return "Lookup limit reached. Use the sheet.";
      used += 1;
      const player = findPlayer(playerName, players);
      if (!player) return `No rostered player named ${playerName}.`;
      if (!serperKey()) return "Search is unavailable. Use the sheet.";
      try {
        const hits = await search(lookupQuery(player, week), complete);
        const text = formatHits(hits);
        snippets.push(text);
        return text;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Search failed.";
        return `${message} Use the sheet.`;
      }
    },
  };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
