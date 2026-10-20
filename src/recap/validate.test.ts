import { describe, expect, test } from "bun:test";
import type { RecapDraft, WeekBrief } from "./types";
import { validateRecap } from "./validate";

const brief: WeekBrief = {
  leagueKey: "461.l.1000",
  leagueName: "Gridiron Guild",
  week: 2,
  weekStart: "2026-10-14",
  weekEnd: "2026-10-20",
  matchups: [
    {
      matchupKey: "t.bench:t.wolves",
      result: "win",
      margin: 42.6,
      winner: {
        teamKey: "t.wolves",
        teamName: "Wolves",
        managerName: "Marcus",
        points: 142.6,
        projectedPoints: 110,
        projectionDelta: 32.6,
        record: { wins: 2, losses: 0, ties: 0 },
        rankBefore: 1,
        rankAfter: 1,
        streak: "W2",
        pointsFor: 282.6,
        pointsAgainst: 190,
        topPerformers: [
          { name: "Star Back", position: "RB", points: 28.4, selectedPosition: "RB" },
        ],
      },
      loser: {
        teamKey: "t.bench",
        teamName: "Bench",
        managerName: "Elena",
        points: 100,
        projectedPoints: 130,
        projectionDelta: -30,
        record: { wins: 0, losses: 2, ties: 0 },
        rankBefore: 4,
        rankAfter: 4,
        streak: "L2",
        pointsFor: 190,
        pointsAgainst: 282.6,
        topPerformers: [],
      },
    },
  ],
  transactions: [
    {
      type: "add",
      status: "successful",
      timestamp: "2026-10-16T15:00:00.000Z",
      faabBid: 12,
      players: [
        {
          name: "Rookie Back",
          action: "add",
          sourceTeamName: null,
          destinationTeamName: "Wolves",
        },
      ],
    },
  ],
};

function draft(headline: string): RecapDraft {
  return {
    column: {
      headline,
      dek: "Bench dropped to 0 and 2.",
      lede: "Wolves hung 142.6 on Bench. Bench fell to 0 and 2.",
      sections: [
        {
          matchupKey: "t.bench:t.wolves",
          heading: "Wolves bury Bench",
          paragraphs: ["Marcus started Star Back for 28.4."],
        },
      ],
      kicker: "Wolves spent 12 on Rookie Back.",
    },
    cards: [
      {
        matchupKey: "t.bench:t.wolves",
        headline,
        dek: "Bench dropped to 0 and 2.",
      },
    ],
  };
}

describe("validateRecap", () => {
  test("accepts a headline that uses a real score", () => {
    expect(validateRecap(brief, draft("Wolves feast: 142.60 buries Bench"))).toEqual({ ok: true });
  });

  test("rejects an invented number", () => {
    const result = validateRecap(brief, draft("Wolves hang 200 on Bench"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.includes("200"))).toBe(true);
  });

  test("rejects an unknown team", () => {
    const result = validateRecap(brief, draft("The Ghosts bury Bench 142.6 to 100"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.includes("Ghosts"))).toBe(true);
  });
});
