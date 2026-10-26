import { describe, expect, test } from "bun:test";
import { scoreLeague, strengthWeights, type ScoreGame, type ScoreTeam } from "./score";

function team(teamKey: string, yahooRank: number | null = null): ScoreTeam {
  return { teamKey, teamName: teamKey, managerName: null, yahooRank };
}

function played(
  week: number,
  home: string,
  homePoints: number,
  away: string,
  awayPoints: number,
  homeProjected: number | null = null,
  awayProjected: number | null = null,
): ScoreGame[] {
  return [
    {
      week,
      teamKey: home,
      opponentTeamKey: away,
      points: homePoints,
      projectedPoints: homeProjected,
      status: "postevent",
    },
    {
      week,
      teamKey: away,
      opponentTeamKey: home,
      points: awayPoints,
      projectedPoints: awayProjected,
      status: "postevent",
    },
  ];
}

function upcoming(week: number, home: string, away: string): ScoreGame[] {
  return [
    {
      week,
      teamKey: home,
      opponentTeamKey: away,
      points: null,
      projectedPoints: null,
      status: "preevent",
    },
    {
      week,
      teamKey: away,
      opponentTeamKey: home,
      points: null,
      projectedPoints: null,
      status: "preevent",
    },
  ];
}

function rankOf(teams: ReturnType<typeof scoreLeague>, teamKey: string) {
  return teams.find((team) => team.teamKey === teamKey)?.rank;
}

describe("strengthWeights", () => {
  test("spreads recent form across the other pieces before three weeks", () => {
    const early = strengthWeights(2);
    expect(early.recent).toBe(0);
    expect(early.allPlay + early.ppg + early.starters + early.projection).toBeCloseTo(1);
    expect(early.allPlay).toBeCloseTo(0.35 / 0.85);

    const full = strengthWeights(3);
    expect(full).toEqual({ allPlay: 0.35, ppg: 0.25, recent: 0.15, starters: 0.15, projection: 0.1 });
  });
});

describe("scoreLeague", () => {
  test("ranks scoring and all-play ahead of the standings record", () => {
    const teams = scoreLeague({
      week: 2,
      teams: [team("Lucky", 1), team("Scorer", 4), team("Ace", 2), team("Doormat", 3)],
      games: [
        ...played(1, "Lucky", 70, "Doormat", 40),
        ...played(1, "Scorer", 150, "Ace", 160),
        ...played(2, "Lucky", 70, "Doormat", 40),
        ...played(2, "Scorer", 150, "Ace", 160),
      ],
      starters: [],
      previousOrder: [],
    });

    expect(rankOf(teams, "Scorer")).toBeLessThan(rankOf(teams, "Lucky") ?? 0);
    expect(teams.find((team) => team.teamKey === "Lucky")).toMatchObject({ wins: 2, losses: 0 });
    expect(teams.find((team) => team.teamKey === "Scorer")).toMatchObject({ wins: 0, losses: 2 });
    expect(teams.find((team) => team.teamKey === "Scorer")?.yahooRank).toBe(4);
  });

  test("a harder slate already played can pass a close team that feasted on a cupcake", () => {
    const keys = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
    const teams = scoreLeague({
      week: 1,
      teams: keys.map((key, index) => team(key, index + 1)),
      games: [
        ...played(1, "T1", 100, "T8", 47),
        ...played(1, "T2", 99, "T3", 98),
        ...played(1, "T4", 97, "T5", 50),
        ...played(1, "T6", 49, "T7", 48),
        ...upcoming(2, "T8", "T1"),
      ],
      starters: [],
      previousOrder: [],
    });

    expect(rankOf(teams, "T2")).toBeLessThan(rankOf(teams, "T1") ?? 99);
    expect(rankOf(teams, "T8") ?? 0).toBeGreaterThan(rankOf(teams, "T4") ?? 99);
    expect(teams.every((team) => team.previousRank === team.rank)).toBe(true);
  });

  test("recent form separates teams with the same season scoring and all-play", () => {
    const teams = scoreLeague({
      week: 4,
      teams: [team("Steady"), team("Hot")],
      games: [
        ...played(1, "Hot", 200, "Steady", 100),
        ...played(2, "Steady", 200, "Hot", 100),
        ...played(3, "Hot", 180, "Steady", 100),
        ...played(4, "Steady", 180, "Hot", 100),
      ],
      starters: [],
      previousOrder: [],
    });

    expect(teams.map((team) => team.teamKey)).toEqual(["Steady", "Hot"]);
    expect(teams[0]?.recentPointsPerGame).toBe(160);
    expect(teams[1]?.recentPointsPerGame).toBe(126.67);
    expect(teams[0]?.pointsPerGame).toBe(teams[1]?.pointsPerGame);
  });

  test("starter season points and projection gap move otherwise equal teams", () => {
    const teams = scoreLeague({
      week: 1,
      teams: [team("Alpha"), team("Zulu")],
      games: played(1, "Alpha", 100, "Zulu", 100, 80, 120),
      starters: [
        { teamKey: "Alpha", seasonPoints: 200 },
        { teamKey: "Alpha", seasonPoints: 100 },
        { teamKey: "Zulu", seasonPoints: 100 },
      ],
      previousOrder: [],
    });

    expect(teams.map((team) => team.teamKey)).toEqual(["Alpha", "Zulu"]);
    expect(teams[0]).toMatchObject({
      starterSeasonPoints: 300,
      projectionGap: 20,
      wins: 0,
      losses: 0,
      ties: 1,
    });
    expect(teams[1]?.projectionGap).toBe(-20);
  });

  test("breaks a true tie by team name and keeps the first ranking still", () => {
    const teams = scoreLeague({
      week: 1,
      teams: [team("Zulu"), team("Alpha")],
      games: played(1, "Zulu", 100, "Alpha", 100),
      starters: [],
      previousOrder: ["Zulu", "Alpha"],
    });

    expect(teams.map((team) => team.teamKey)).toEqual(["Alpha", "Zulu"]);
    expect(teams[0]?.previousRank).toBe(2);
    expect(teams[1]?.previousRank).toBe(1);
  });

  test("counts all-play against the rest of the league, not just the head-to-head", () => {
    const teams = scoreLeague({
      week: 1,
      teams: [team("A"), team("B"), team("C"), team("D")],
      games: [...played(1, "A", 130, "B", 100), ...played(1, "C", 110, "D", 80)],
      starters: [],
      previousOrder: [],
    });
    const leader = teams.find((team) => team.teamKey === "A");
    expect(leader).toMatchObject({ allPlayWins: 3, allPlayLosses: 0, allPlayTies: 0, rank: 1 });
  });
});
