import { inWeekWindow } from "../recap/brief";

export type ActivityTransaction = {
  type: string | null;
  status: string | null;
  timestamp: Date | null;
  faabBid: number | null;
  players: unknown;
};

export function activityNotes(
  rows: ActivityTransaction[],
  start: string | null,
  end: string | null,
): Map<string, string> {
  const lines = new Map<string, string[]>();
  const ordered = [...rows].sort(
    (a, b) => (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0),
  );
  for (const row of ordered) {
    if (row.status !== "successful" || !row.timestamp || !inWeekWindow(row.timestamp, start, end)) {
      continue;
    }
    const added = playerMoves(row.players).filter((player) => player.action === "add");
    if (row.faabBid != null && row.faabBid > 0) {
      for (const player of added) {
        pushLine(lines, player.destinationTeamKey, `Added ${player.name} for ${row.faabBid}.`);
      }
    }
    if (row.type === "trade") {
      for (const player of added) {
        pushLine(lines, player.destinationTeamKey, `Traded for ${player.name}.`);
      }
    }
  }
  return new Map([...lines.entries()].map(([teamKey, parts]) => [teamKey, parts.join(" ")]));
}

function pushLine(lines: Map<string, string[]>, teamKey: string, line: string) {
  const current = lines.get(teamKey) ?? [];
  current.push(line);
  lines.set(teamKey, current);
}

function playerMoves(players: unknown): Array<{ name: string; action: string; destinationTeamKey: string }> {
  if (!Array.isArray(players)) return [];
  return players.flatMap((player) => {
    if (!player || typeof player !== "object") return [];
    const row = player as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name || typeof row.type !== "string" || typeof row.destinationTeamKey !== "string") return [];
    return [{ name, action: row.type, destinationTeamKey: row.destinationTeamKey }];
  });
}
