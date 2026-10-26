import { describe, expect, test } from "bun:test";
import { assembleDossier, type DossierSource } from "./dossier";
import { labelStats, playoffTeamCount, rosterSlots } from "./stats";
import { recordsThrough, seasonMemory } from "./memory";

describe("stat labels", () => {
  test("keeps named non-zero lines", () => {
    const labels = new Map([
      [4, "Rec"],
      [5, "Rush Yds"],
    ]);
    expect(labelStats([{ statId: 4, value: "8" }, { statId: 5, value: "0" }, { statId: 9, value: "3" }], labels)).toEqual([
      { label: "Rec", value: 8 },
    ]);
  });

  test("reads playoff teams and roster slots from Yahoo settings", () => {
    expect(playoffTeamCount({ settings: { num_playoff_teams: "4" } })).toBe(4);
    expect(playoffTeamCount({})).toBeNull();
    expect(
      rosterSlots([{ roster_position: { position: "QB", count: "1" } }, { roster_position: { position: "RB", count: 2 } }]),
    ).toEqual(["QB", "RB x2"]);
  });
});

describe("season memory", () => {
  const teams = [
    { teamKey: "a", teamName: "Wolves" },
    { teamKey: "b", teamName: "Bench" },
  ];

  test("records the biggest win, the series, and games back", () => {
    const memory = seasonMemory(
      teams,
      [
        game(1, "a", "b", 140, 90),
        game(1, "b", "a", 90, 140),
        game(2, "a", "b", 110, 100),
        game(2, "b", "a", 100, 110),
        { week: 3, teamKey: "a", opponentTeamKey: "b", points: null, status: "preevent" },
      ],
      2,
      1,
      4,
    );
    const wolves = memory.get("a");
    expect(wolves?.biggestWin).toEqual({ opponentName: "Bench", margin: 50, week: 1 });
    expect(wolves?.headToHead).toEqual([{ opponentName: "Bench", wins: 2, losses: 0, ties: 0 }]);
    expect(wolves?.longestStreak).toBe("W2");
    expect(wolves?.weekResult?.result).toBe("win");
    expect(wolves?.remainingOpponents).toEqual([{ name: "Bench", pointsPerGame: 95 }]);
    expect(wolves?.playoff).toEqual({ gamesBack: 0, teamsAhead: 0, weeksLeft: 2 });
    expect(memory.get("b")?.playoff?.teamsAhead).toBe(1);
  });

  test("records through a week match season memory ranks", () => {
    const games = [
      game(1, "a", "b", 140, 90),
      game(1, "b", "a", 90, 140),
      game(2, "a", "b", 110, 100),
      game(2, "b", "a", 100, 110),
    ];
    const records = recordsThrough(teams, games, 2);
    const memory = seasonMemory(teams, games, 2, null, null);
    const wolves = records.find((row) => row.teamKey === "a");
    expect(wolves).toMatchObject({ wins: 2, losses: 0, ties: 0, pointsFor: 250, pointsAgainst: 190, rank: 1 });
    expect(wolves?.rank).toBe(memory.get("a")?.rankByWeek.at(-1)?.rank);
    expect(records.find((row) => row.teamKey === "b")?.rank).toBe(memory.get("b")?.rankByWeek.at(-1)?.rank);
  });
});

describe("assembleDossier", () => {
  test("sums bench points and labels the lineup", () => {
    const dossier = assembleDossier(source());
    const wolves = dossier.teams.find((team) => team.teamName === "Wolves");
    expect(wolves?.benchPoints).toBe(18);
    expect(wolves?.weekStarterPoints).toBe(28.4);
    expect(wolves?.lineup[0]?.weekStats).toEqual([{ label: "Rec", value: 8 }]);
    expect(wolves?.lineup[0]?.draftPick).toBe(4);
    expect(wolves?.faabBalance).toBe(42);
  });

  test("rewinds later transactions and hides live snapshots", () => {
    const dossier = assembleDossier(pastSource());
    const wolves = dossier.teams.find((team) => team.teamName === "Wolves");
    const bench = dossier.teams.find((team) => team.teamName === "Bench");
    expect(wolves?.faabBalance).toBe(57);
    expect(wolves?.moves).toBe(2);
    expect(wolves?.trades).toBe(1);
    expect(wolves?.waiverPriority).toBeNull();
    expect(wolves?.yahooRank).toBe(1);
    expect(bench?.faabBalance).toBe(10);
    expect(bench?.moves).toBe(0);
    expect(bench?.trades).toBe(1);
    expect(bench?.yahooRank).toBe(2);
    const star = wolves?.lineup.find((player) => player.name === "Star Back");
    expect(star?.seasonPoints).toBe(28.4);
    expect(star?.injuryStatus).toBeNull();
    expect(star?.injuryNote).toBeNull();
    expect(star?.percentOwned).toBeNull();
  });
});

function game(week: number, teamKey: string, opponentTeamKey: string, points: number, _opponent: number) {
  return { week, teamKey, opponentTeamKey, points, status: "postevent" };
}

function source(): DossierSource {
  return {
    leagueKey: "461.l.1",
    leagueName: "Guild",
    week: 1,
    weekStart: "2026-10-01",
    weekEnd: "2026-10-07",
    scoringType: "head",
    rosterSlots: ["QB"],
    playoffTeams: null,
    endWeek: 14,
    teams: [
      {
        teamKey: "a",
        name: "Wolves",
        managers: [{ nickname: "Marcus" }],
        faabBalance: 42,
        waiverPriority: 3,
        moves: 2,
        trades: 1,
        yahooRank: 1,
      },
    ],
    matchups: [
      {
        week: 1,
        teamKey: "a",
        opponentTeamKey: "b",
        points: "120",
        projectedPoints: "100",
        isWinner: true,
        status: "postevent",
      },
    ],
    rosters: [
      {
        teamKey: "a",
        playerKey: "p1",
        playerName: "Star Back",
        displayPosition: "RB",
        selectedPosition: "RB",
        nflTeam: "GB",
        injuryStatus: null,
        injuryNote: null,
        percentOwned: 99,
        seasonPoints: 80,
        weekPoints: 28.4,
        weekStats: [{ label: "Rec", value: 8 }],
        draftRound: 1,
        draftPick: 4,
      },
      {
        teamKey: "a",
        playerKey: "p2",
        playerName: "Punter",
        displayPosition: "K",
        selectedPosition: "BN",
        nflTeam: null,
        injuryStatus: null,
        injuryNote: null,
        percentOwned: null,
        seasonPoints: null,
        weekPoints: 18,
        weekStats: [],
        draftRound: null,
        draftPick: null,
      },
    ],
    transactions: [],
    asOfLatest: true,
    playerScores: [],
  };
}

function pastSource(): DossierSource {
  const base = source();
  return {
    ...base,
    asOfLatest: false,
    teams: [
      {
        teamKey: "a",
        name: "Wolves",
        managers: [{ nickname: "Marcus" }],
        faabBalance: 42,
        waiverPriority: 3,
        moves: 4,
        trades: 2,
        yahooRank: 8,
      },
      {
        teamKey: "b",
        name: "Bench",
        managers: [{ nickname: "Ned" }],
        faabBalance: 10,
        waiverPriority: 1,
        moves: 0,
        trades: 2,
        yahooRank: 7,
      },
    ],
    matchups: [
      {
        week: 1,
        teamKey: "a",
        opponentTeamKey: "b",
        points: "120",
        projectedPoints: "100",
        isWinner: true,
        status: "postevent",
      },
      {
        week: 1,
        teamKey: "b",
        opponentTeamKey: "a",
        points: "90",
        projectedPoints: "110",
        isWinner: false,
        status: "postevent",
      },
    ],
    rosters: [
      {
        ...base.rosters[0]!,
        injuryStatus: "Q",
        injuryNote: "knee",
        percentOwned: 99,
        seasonPoints: 80,
      },
      base.rosters[1]!,
    ],
    playerScores: [
      { playerKey: "p1", week: 1, points: 28.4 },
      { playerKey: "p1", week: 2, points: 40 },
      { playerKey: "p1", week: 1, points: 10 },
      { playerKey: "p2", week: 1, points: 18 },
    ],
    transactions: [
      move("2026-10-05T15:00:00.000Z", "successful", 10, "add", [
        { type: "add", destinationTeamKey: "a", sourceTeamKey: null },
      ]),
      move("2026-10-08T15:00:00.000Z", "successful", 15, "add", [
        { type: "add", destinationTeamKey: "a", sourceTeamKey: null },
      ]),
      move("2026-10-09T15:00:00.000Z", "successful", null, "drop", [
        { type: "drop", destinationTeamKey: null, sourceTeamKey: "a" },
      ]),
      move("2026-10-10T15:00:00.000Z", "failed", 50, "add", [
        { type: "add", destinationTeamKey: "a", sourceTeamKey: null },
      ]),
      move("2026-10-11T15:00:00.000Z", "successful", null, "drop", [
        { type: "drop", destinationTeamKey: null, sourceTeamKey: "b" },
      ]),
      move("2026-10-12T15:00:00.000Z", "successful", null, "trade", [
        { type: "add", destinationTeamKey: "a", sourceTeamKey: "b" },
        { type: "add", destinationTeamKey: "b", sourceTeamKey: "a" },
      ]),
    ],
  };
}

function move(
  timestamp: string,
  status: string,
  faabBid: number | null,
  type: string,
  players: Array<{ type: string; destinationTeamKey: string | null; sourceTeamKey: string | null }>,
) {
  return { type, status, timestamp: new Date(timestamp), faabBid, players };
}
