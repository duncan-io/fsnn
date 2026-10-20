import { describe, expect, test } from "bun:test";
import { pickAngle, scoreResults, scoreWaivers, usedAngleKey } from "./angles";
import type { TeamSeason, WaiverAdd, WeekLine } from "./types";

function team(partial: Partial<TeamSeason> & Pick<TeamSeason, "teamKey" | "teamName" | "rank">): TeamSeason {
  return {
    wins: 4,
    losses: 3,
    ties: 0,
    pointsFor: 800,
    pointsAgainst: 800,
    moves: 2,
    ...partial,
  };
}

describe("record angles", () => {
  test("flags a record that is ahead of the points", () => {
    const angles = scoreResults(
      [
        team({ teamKey: "a", teamName: "Wolves", rank: 1, wins: 6, losses: 1, pointsFor: 700 }),
        team({ teamKey: "b", teamName: "Pirates", rank: 2, wins: 5, losses: 2, pointsFor: 900 }),
        team({ teamKey: "c", teamName: "Tavern", rank: 3, wins: 4, losses: 3, pointsFor: 850 }),
        team({ teamKey: "d", teamName: "Diners", rank: 4, wins: 3, losses: 4, pointsFor: 820 }),
      ],
      [],
    );
    const ahead = angles.find((angle) => angle.angleId === "record-ahead" && angle.teamKeys[0] === "a");
    expect(ahead?.claim).toContain("Wolves");
    expect(ahead?.claim).toContain("ahead of the points");
    expect(ahead?.heat).toBe(24);
    expect(ahead?.evidence.join(" ")).toContain("6-1");
    expect(ahead?.evidence.join(" ")).toContain("700.0");
  });

  test("flags a record that is behind the points", () => {
    const angles = scoreResults(
      [
        team({ teamKey: "a", teamName: "Wolves", rank: 1, pointsFor: 700 }),
        team({ teamKey: "b", teamName: "Pirates", rank: 2, pointsFor: 680 }),
        team({ teamKey: "c", teamName: "Tavern", rank: 6, wins: 2, losses: 5, pointsFor: 980 }),
      ],
      [],
    );
    const found = angles.find((angle) => angle.angleId === "record-behind");
    expect(found?.teamKeys).toEqual(["c"]);
    expect(found?.claim).toContain("behind the points");
  });

  test("ignores a one-spot gap", () => {
    const angles = scoreResults(
      [
        team({ teamKey: "a", teamName: "Wolves", rank: 1, pointsFor: 900 }),
        team({ teamKey: "b", teamName: "Pirates", rank: 2, pointsFor: 800 }),
      ],
      [],
    );
    expect(angles.filter((angle) => angle.angleId.startsWith("record-"))).toHaveLength(0);
  });
});

describe("projection angles", () => {
  const standings = [team({ teamKey: "a", teamName: "Wolves", rank: 1, pointsFor: 900 })];

  test("flags a boom and a bust", () => {
    const boom: WeekLine = {
      week: 6,
      teamKey: "a",
      teamName: "Wolves",
      points: 140,
      projectedPoints: 100,
      opponentName: "Pirates",
      opponentPoints: 90,
      seasonPointsFor: 900,
      wins: 6,
      losses: 1,
      ties: 0,
    };
    const bust: WeekLine = { ...boom, teamKey: "b", teamName: "Tavern", points: 70, projectedPoints: 110, opponentPoints: 120 };
    const angles = scoreResults(standings, [boom, bust]);
    const hot = angles.find((angle) => angle.angleId === "weekly-boom");
    const cold = angles.find((angle) => angle.angleId === "weekly-bust");
    expect(hot?.heat).toBe(40);
    expect(hot?.evidence.join(" ")).toContain("beat Pirates");
    expect(cold?.claim).toContain("bust");
    expect(cold?.evidence.join(" ")).toContain("lost to Pirates");
  });

  test("ignores an 11 point miss", () => {
    const line: WeekLine = {
      week: 6,
      teamKey: "a",
      teamName: "Wolves",
      points: 111,
      projectedPoints: 100,
      opponentName: "Pirates",
      opponentPoints: 90,
      seasonPointsFor: 900,
      wins: 6,
      losses: 1,
      ties: 0,
    };
    expect(scoreResults(standings, [line]).some((angle) => angle.angleId.startsWith("weekly-"))).toBe(false);
  });
});

describe("waiver angles", () => {
  const standings = [
    team({ teamKey: "a", teamName: "Wolves", rank: 1, wins: 6, losses: 1, moves: 4, pointsFor: 900 }),
    team({ teamKey: "b", teamName: "Tavern", rank: 8, wins: 2, losses: 5, moves: 9, pointsFor: 700 }),
    team({ teamKey: "c", teamName: "Diners", rank: 9, wins: 1, losses: 6, moves: 3, pointsFor: 600 }),
  ];

  test("keeps the largest FAAB add and skips a small bid", () => {
    const adds: WaiverAdd[] = [
      {
        teamKey: "a",
        teamName: "Wolves",
        playerName: "Ace",
        bid: 42,
        seasonPoints: 18.4,
        wins: 6,
        losses: 1,
        ties: 0,
        rank: 1,
        pointsFor: 900,
      },
      {
        teamKey: "c",
        teamName: "Diners",
        playerName: "Bit",
        bid: 3,
        seasonPoints: 4,
        wins: 1,
        losses: 6,
        ties: 0,
        rank: 9,
        pointsFor: 600,
      },
    ];
    const angles = scoreWaivers(standings, adds);
    const bids = angles.filter((angle) => angle.angleId === "faab-add");
    expect(bids).toHaveLength(1);
    expect(bids[0]?.heat).toBe(42);
    expect(bids[0]?.evidence.join(" ")).toContain("18.4");
  });

  test("aims churn at the team with the most moves", () => {
    const churn = scoreWaivers(standings, []).find((angle) => angle.angleId === "churn-bottom");
    expect(churn?.teamKeys).toEqual(["b"]);
    expect(churn?.claim).toContain("9 roster moves");
    expect(churn?.heat).toBe(45);
  });
});

describe("pickAngle", () => {
  test("skips an angle already used for that team", () => {
    const angles = scoreResults(
      [
        team({ teamKey: "a", teamName: "Wolves", rank: 1, wins: 6, losses: 1, pointsFor: 700 }),
        team({ teamKey: "b", teamName: "Pirates", rank: 4, wins: 2, losses: 5, pointsFor: 980 }),
        team({ teamKey: "c", teamName: "Tavern", rank: 2, pointsFor: 900 }),
        team({ teamKey: "d", teamName: "Diners", rank: 3, pointsFor: 850 }),
      ],
      [],
    );
    const used = new Set([usedAngleKey("record-ahead", "a")]);
    const picked = pickAngle(angles, used);
    expect(picked?.angleId).toBe("record-behind");
    expect(picked?.teamKeys).toEqual(["b"]);
  });

  test("returns null when nothing clears the floor", () => {
    expect(pickAngle([{ angleId: "faab-add", claim: "x", evidence: [], counterEvidence: [], heat: 4, teamKeys: ["a"] }], new Set())).toBeNull();
  });
});
