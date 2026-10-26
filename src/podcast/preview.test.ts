import { describe, expect, test } from "bun:test";
import type { BriefMatchupRow } from "../recap/types";
import { buildPreviewMatchups } from "./preview";

describe("buildPreviewMatchups", () => {
  test("pairs the requested week and keeps projected points", () => {
    const names = new Map([
      ["t.bench", "Bench"],
      ["t.wolves", "Wolves"],
      ["t.hail", "Hail"],
    ]);
    const matchups = buildPreviewMatchups(
      [
        ...pair(7, "t.wolves", "t.bench", "10", "11"),
        ...pair(8, "t.wolves", "t.bench", "115.5", null),
        ...pair(8, "t.hail", "t.bench", null, "108"),
        { week: 8, teamKey: "t.wolves", opponentTeamKey: null, points: null, projectedPoints: "99", isWinner: null, status: null },
      ],
      8,
      names,
    );
    expect(matchups.map((matchup) => matchup.matchupKey)).toEqual(["t.bench:t.hail", "t.bench:t.wolves"]);
    expect(matchups[1]).toMatchObject({
      home: { teamName: "Wolves", projectedPoints: 115.5 },
      away: { teamName: "Bench", projectedPoints: null },
    });
    expect(matchups[0]?.home.projectedPoints).toBe(null);
    expect(matchups[0]?.away.projectedPoints).toBe(108);
  });
});

function pair(week: number, home: string, away: string, homeProjected: string | null, awayProjected: string | null): BriefMatchupRow[] {
  return [
    { week, teamKey: home, opponentTeamKey: away, points: null, projectedPoints: homeProjected, isWinner: null, status: null },
    { week, teamKey: away, opponentTeamKey: home, points: null, projectedPoints: awayProjected, isWinner: null, status: null },
  ];
}
