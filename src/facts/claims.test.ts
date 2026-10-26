import { describe, expect, test } from "bun:test";
import type { BriefMatchup, BriefTransaction } from "../recap/types";
import { pointTotalErrors, rankErrors, resultErrors } from "./claims";
import { matchupLeads } from "./leads";

const matchup: BriefMatchup = {
  matchupKey: "a:b",
  result: "win",
  margin: 20,
  winner: {
    teamKey: "a",
    teamName: "Wolves",
    managerName: "Marcus",
    points: 120,
    projectedPoints: 100,
    projectionDelta: 20,
    record: { wins: 1, losses: 0, ties: 0 },
    rankBefore: 2,
    rankAfter: 1,
    streak: "W1",
    pointsFor: 120,
    pointsAgainst: 100,
    topPerformers: [],
    benchPoints: 14,
  },
  loser: {
    teamKey: "b",
    teamName: "Bench",
    managerName: "Elena",
    points: 100,
    projectedPoints: 110,
    projectionDelta: -10,
    record: { wins: 0, losses: 1, ties: 0 },
    rankBefore: 1,
    rankAfter: 2,
    streak: "L1",
    pointsFor: 100,
    pointsAgainst: 120,
    topPerformers: [],
    benchPoints: null,
  },
};

describe("matchup leads", () => {
  test("keeps the three sharpest facts", () => {
    const transactions: BriefTransaction[] = [
      {
        type: "add",
        status: "successful",
        timestamp: "2026-10-02T00:00:00.000Z",
        faabBid: 22,
        players: [{ name: "Rookie", action: "add", sourceTeamName: null, destinationTeamName: "Wolves" }],
      },
    ];
    expect(matchupLeads(matchup, transactions)).toEqual([
      "Wolves added Rookie for 22.",
      "Wolves scored 20 over a 100 projection.",
      "Wolves won by 20.",
    ]);
  });
});

describe("claim checks", () => {
  test("rejects a loser described as the winner and a wrong rank move", () => {
    const results = [{ result: "win" as const, winnerName: "Wolves", loserName: "Bench" }];
    expect(resultErrors("Bench beat Wolves.", results)).toContain("Bench did not win.");
    expect(resultErrors("Wolves beat the projection.", results)).toEqual([]);
    expect(rankErrors("Bench climbed in the rank.", [{ name: "Bench", before: 1, after: 2 }])).toContain(
      "Bench fell from rank 1 to rank 2.",
    );
    expect(rankErrors("Bench dropped to 0 and 2.", [{ name: "Bench", before: 1, after: 2 }])).toEqual([]);
  });

  test("rejects a player point total that is not the sheet", () => {
    expect(pointTotalErrors("Star Back scored 30 points.", [{ name: "Star Back", weekPoints: 28.4 }])).toEqual([
      "Star Back scored 28.4 points.",
    ]);
    expect(pointTotalErrors("Star Back scored 28.4 points.", [{ name: "Star Back", weekPoints: 28.4 }])).toEqual([]);
  });
});
