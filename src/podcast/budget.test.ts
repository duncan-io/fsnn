import { describe, expect, test } from "bun:test";
import type { BriefSide, WeekBrief } from "../recap/types";
import { planSegments } from "./budget";
import type { PreviewBrief } from "./preview";

describe("planSegments", () => {
  test("covers each matchup, skips an empty wire, and budgets about 2000 words", () => {
    const plan = planSegments(brief(false), preview());
    expect(plan.map((segment) => segment.kind)).toEqual(["open", "recap", "recap", "preview", "close"]);
    expect(plan.map((segment) => segment.id)).toEqual(["open", "recap:a:b", "recap:c:d", "preview:a:b", "close"]);
    expect(plan.reduce((sum, segment) => sum + segment.budget, 0)).toBe(2000);
  });

  test("keeps the wire when the week had a transaction", () => {
    const plan = planSegments(brief(true), null);
    expect(plan.map((segment) => segment.kind)).toContain("wire");
    expect(plan.map((segment) => segment.kind)).not.toContain("preview");
    expect(plan.reduce((sum, segment) => sum + segment.budget, 0)).toBe(2000);
  });
});

function brief(withWire: boolean): WeekBrief {
  return {
    leagueKey: "guild",
    leagueName: "Guild",
    week: 6,
    weekStart: null,
    weekEnd: null,
    matchups: [
      {
        matchupKey: "a:b",
        result: "win",
        margin: 10,
        winner: side("a", "Wolves", 120),
        loser: side("b", "Bench", 110),
      },
      {
        matchupKey: "c:d",
        result: "win",
        margin: 4,
        winner: side("c", "Hail", 100),
        loser: side("d", "Realtors", 96),
      },
    ],
    transactions: withWire
      ? [{ type: "add", status: "successful", timestamp: "2026-10-20", faabBid: 12, players: [] }]
      : [],
  };
}

function preview(): PreviewBrief {
  return {
    leagueKey: "guild",
    leagueName: "Guild",
    week: 7,
    matchups: [
      {
        matchupKey: "a:b",
        home: { teamKey: "a", teamName: "Wolves", projectedPoints: 115 },
        away: { teamKey: "b", teamName: "Bench", projectedPoints: 108 },
      },
    ],
    teams: [],
  };
}

function side(teamKey: string, teamName: string, points: number): BriefSide {
  return {
    teamKey,
    teamName,
    managerName: null,
    points,
    projectedPoints: null,
    projectionDelta: null,
    record: { wins: 1, losses: 0, ties: 0 },
    rankBefore: 2,
    rankAfter: 1,
    streak: "W1",
    pointsFor: points,
    pointsAgainst: 90,
    topPerformers: [],
  };
}
