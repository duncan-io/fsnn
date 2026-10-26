import { describe, expect, test } from "bun:test";
import type { RankingsBrief, RankingsDraft } from "./types";
import { validateRankings } from "./validate";

const brief: RankingsBrief = {
  leagueKey: "461.l.1000",
  leagueName: "Gridiron Guild",
  week: 2,
  teams: [
    {
      teamKey: "t.wolves",
      teamName: "Wolves",
      managerName: "Marcus",
      rank: 1,
      previousRank: 2,
      wins: 2,
      losses: 0,
      ties: 0,
      yahooRank: 3,
      pointsFor: 240,
      pointsAgainst: 180,
      pointsPerGame: 120,
      allPlayWins: 6,
      allPlayLosses: 2,
      allPlayTies: 0,
      recentPointsPerGame: null,
      starterSeasonPoints: 310,
      weekStarterPoints: null,
      projectionGap: 12.5,
      pastOpponentPointsPerGame: 108,
      remainingOpponentPointsPerGame: 96,
      streak: "W2",
      streakCount: 2,
      note: "Added Rookie Back for 12.",
    },
    {
      teamKey: "t.bench",
      teamName: "Bench",
      managerName: "Elena",
      rank: 2,
      previousRank: 1,
      wins: 0,
      losses: 2,
      ties: 0,
      yahooRank: 1,
      pointsFor: 180,
      pointsAgainst: 240,
      pointsPerGame: 90,
      allPlayWins: 2,
      allPlayLosses: 6,
      allPlayTies: 0,
      recentPointsPerGame: null,
      starterSeasonPoints: 140,
      weekStarterPoints: null,
      projectionGap: -8,
      pastOpponentPointsPerGame: 120,
      remainingOpponentPointsPerGame: 101,
      streak: "L2",
      streakCount: 2,
      note: null,
    },
  ],
};

function draft(overrides: Partial<RankingsDraft> = {}): RankingsDraft {
  return {
    headline: "Wolves lead the week 2 power rankings",
    dek: "Marcus climbs past Yahoo rank 3.",
    lede: "Wolves score 120 a game. Bench still sits at Yahoo rank 1.",
    entries: [
      {
        teamKey: "t.wolves",
        paragraphs: ["Wolves added Rookie Back for 12 and outscored a 108 opponent slate."],
      },
      {
        teamKey: "t.bench",
        paragraphs: ["Elena is 0 and 2 with 90 a game."],
      },
    ],
    kicker: "Wolves are the widest gap, 1 in these rankings and 3 in Yahoo.",
    ...overrides,
  };
}

describe("validateRankings", () => {
  test("accepts the computed order", () => {
    expect(validateRankings(brief, draft()).ok).toBe(true);
  });

  test("rejects a reordered team and an invented number", () => {
    const swapped = draft({
      entries: [
        { teamKey: "t.bench", paragraphs: ["Elena is 0 and 2."] },
        { teamKey: "t.wolves", paragraphs: ["Wolves scored 999."] },
      ],
    });
    const result = validateRankings(brief, swapped);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.includes("t.wolves"))).toBe(true);
      expect(result.errors.some((error) => error.includes("999"))).toBe(true);
    }
  });
});
