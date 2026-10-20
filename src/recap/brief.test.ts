import { describe, expect, test } from "bun:test";
import { buildWeekBrief, completedWeek, inWeekWindow } from "./brief";
import type { BriefInput, BriefMatchupRow, BriefTeamRow } from "./types";

const teams: BriefTeamRow[] = [
  { teamKey: "t.wolves", name: "Wolves", managers: [{ nickname: "Marcus" }] },
  { teamKey: "t.bench", name: "Bench", managers: [{ nickname: "Elena" }] },
  { teamKey: "t.realtors", name: "Realtors", managers: [{ nickname: "Amina" }] },
  { teamKey: "t.hail", name: "Hail", managers: [{ nickname: "Cole" }] },
];

function rows(
  week: number,
  homeKey: string,
  awayKey: string,
  homePoints: string,
  awayPoints: string,
  homeProjected: string,
  awayProjected: string,
): BriefMatchupRow[] {
  return [
    {
      week,
      teamKey: homeKey,
      opponentTeamKey: awayKey,
      points: homePoints,
      projectedPoints: homeProjected,
      isWinner: Number(homePoints) > Number(awayPoints),
      status: "postevent",
    },
    {
      week,
      teamKey: awayKey,
      opponentTeamKey: homeKey,
      points: awayPoints,
      projectedPoints: awayProjected,
      isWinner: Number(awayPoints) > Number(homePoints),
      status: "postevent",
    },
  ];
}

function input(): BriefInput {
  return {
    leagueKey: "461.l.1000",
    leagueName: "Gridiron Guild",
    week: 2,
    weekStart: "2026-10-14",
    weekEnd: "2026-10-20",
    teams,
    matchups: [
      ...rows(1, "t.wolves", "t.bench", "140.0", "90.0", "120.0", "110.0"),
      ...rows(1, "t.realtors", "t.hail", "100.0", "99.0", "105.0", "100.0"),
      ...rows(2, "t.wolves", "t.bench", "142.6", "100.0", "110.0", "130.0"),
      ...rows(2, "t.realtors", "t.hail", "121.8", "118.6", "115.0", "116.0"),
    ],
    rosters: [
      {
        teamKey: "t.wolves",
        week: 2,
        playerKey: "p.star",
        playerName: "Star Back",
        displayPosition: "RB",
        selectedPosition: "RB",
        raw: { player_points: { total: "28.4" } },
      },
      {
        teamKey: "t.wolves",
        week: 2,
        playerKey: "p.punt",
        playerName: "Punter",
        displayPosition: "K",
        selectedPosition: "BN",
        raw: { player_points: { total: "18.0" } },
      },
    ],
    transactions: [
      {
        type: "add",
        status: "successful",
        timestamp: new Date("2026-10-16T15:00:00.000Z"),
        faabBid: 12,
        players: [{ name: "Rookie Back", type: "add", destinationTeamKey: "t.wolves" }],
      },
      {
        type: "add",
        status: "successful",
        timestamp: new Date("2026-10-21T01:00:00.000Z"),
        faabBid: 4,
        players: [{ name: "Late Add", type: "add", destinationTeamKey: "t.hail" }],
      },
    ],
  };
}

describe("buildWeekBrief", () => {
  test("separates a blowout, a one-score game, and a projection miss", () => {
    const brief = buildWeekBrief(input());
    const blowout = brief.matchups[0];
    const close = brief.matchups[1];
    expect(blowout?.winner.teamName).toBe("Wolves");
    expect(blowout?.winner.points).toBe(142.6);
    expect(blowout?.loser.points).toBe(100);
    expect(blowout?.margin).toBe(42.6);
    expect(blowout?.loser.projectionDelta).toBe(-30);
    expect(close?.margin).toBe(3.2);
    expect(close?.winner.teamName).toBe("Realtors");
    expect(close?.loser.teamName).toBe("Hail");
  });

  test("records the record and rank after the recap week", () => {
    const brief = buildWeekBrief(input());
    const wolves = brief.matchups[0]?.winner;
    expect(wolves?.record).toEqual({ wins: 2, losses: 0, ties: 0 });
    expect(wolves?.rankBefore).toBe(1);
    expect(wolves?.rankAfter).toBe(1);
    expect(wolves?.streak).toBe("W2");
    expect(brief.matchups[0]?.loser.record).toEqual({ wins: 0, losses: 2, ties: 0 });
    expect(brief.matchups[1]?.winner.rankAfter).toBe(2);
  });

  test("keeps starters and drops bench scores", () => {
    const brief = buildWeekBrief(input());
    expect(brief.matchups[0]?.winner.topPerformers).toEqual([
      { name: "Star Back", position: "RB", points: 28.4, selectedPosition: "RB" },
    ]);
  });

  test("keeps transactions inside the week window and drops the rest", () => {
    const brief = buildWeekBrief(input());
    expect(brief.transactions).toHaveLength(1);
    expect(brief.transactions[0]?.faabBid).toBe(12);
    expect(brief.transactions[0]?.players[0]?.name).toBe("Rookie Back");
    expect(brief.transactions[0]?.players[0]?.destinationTeamName).toBe("Wolves");
  });
});

describe("completed weeks", () => {
  test("picks the latest week that is entirely final", () => {
    const rows = [
      { week: 1, status: "postevent" },
      { week: 2, status: "postevent" },
      { week: 3, status: "midevent" },
    ];
    expect(completedWeek(rows)).toBe(2);
    expect(completedWeek(rows, 1)).toBe(1);
    expect(completedWeek(rows, 3)).toBeNull();
  });

  test("compares calendar dates for the week window", () => {
    expect(inWeekWindow(new Date("2026-10-20T23:00:00.000Z"), "2026-10-14", "2026-10-20")).toBe(true);
    expect(inWeekWindow(new Date("2026-10-21T00:00:00.000Z"), "2026-10-14", "2026-10-20")).toBe(false);
  });
});
