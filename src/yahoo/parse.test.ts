import { describe, expect, test } from "bun:test";
import {
  extractDraftPicks,
  extractGameWeeks,
  extractGames,
  extractLeagues,
  extractMatchups,
  extractPlayers,
  extractStatCategories,
  extractTeams,
  extractTransactions,
} from "./extract";
import { flattenYahoo, normalizeYahooPath } from "./parse";

const standings = {
  fantasy_content: {
    "xml:lang": "en-US",
    league: [
      {
        league_key: "461.l.1000",
        league_id: "1000",
        name: "Gridiron",
        num_teams: 2,
        current_week: "6",
        start_week: "1",
        end_week: "17",
        scoring_type: "head",
        league_type: "private",
        draft_status: "postdraft",
      },
      {
        standings: [
          {
            teams: {
              "0": {
                team: [
                  [
                    { team_key: "461.l.1000.t.1" },
                    { team_id: "1" },
                    { name: "Home" },
                    { waiver_priority: 3 },
                    { faab_balance: "42" },
                    {
                      managers: [{ manager: { manager_id: "9", nickname: "Sam", is_commissioner: "1" } }],
                    },
                  ],
                  {
                    team_standings: {
                      rank: 1,
                      outcome_totals: { wins: "4", losses: "1", ties: "0", percentage: ".800" },
                      points_for: "612.34",
                      points_against: "540.10",
                    },
                  },
                ],
              },
              "1": {
                team: [
                  [
                    { team_key: "461.l.1000.t.2" },
                    { team_id: "2" },
                    { name: "Away" },
                  ],
                  {
                    team_standings: {
                      rank: 2,
                      outcome_totals: { wins: "1", losses: "4", ties: "0", percentage: ".200" },
                      points_for: "540.10",
                      points_against: "612.34",
                    },
                  },
                ],
              },
              count: 2,
            },
          },
        ],
      },
    ],
  },
};

const gameWeeks = {
  fantasy_content: {
    game: [
      { game_key: "461", game_id: "461", name: "Football", code: "nfl", season: "2026" },
      {
        game_weeks: {
          "0": { game_week: { week: "1", start: "2026-09-10", end: "2026-09-14" } },
          "1": { game_week: { week: "2", start: "2026-09-15", end: "2026-09-21" } },
          count: 2,
        },
      },
    ],
  },
};

const player = {
  fantasy_content: {
    league: [
      {
        league_key: "461.l.1000",
        league_id: "1000",
        name: "Gridiron",
        num_teams: 12,
      },
      {
        players: {
          "0": {
            player: [
              [
                { player_key: "461.p.30121" },
                { player_id: "30121" },
                { name: { full: "Christian McCaffrey", first: "Christian", last: "McCaffrey" } },
                { editorial_team_abbr: "SF" },
                { display_position: "RB" },
                { eligible_positions: [{ position: "RB" }, { position: "W/R/T" }] },
                { status: "H" },
              ],
              { selected_position: [{ position: "RB" }, { is_flex: 0 }] },
              {
                ownership: { ownership_type: "team", owner_team_key: "461.l.1000.t.1" },
                percent_owned: { value: "99" },
                player_stats: {
                  coverage_type: "season",
                  stats: {
                    "0": { stat: { stat_id: "4", value: "1200" } },
                    count: 1,
                  },
                },
                player_points: { total: "180.4" },
              },
            ],
          },
          count: 1,
        },
      },
    ],
  },
};

describe("flattenYahoo", () => {
  test("merges league standings and keeps repeated position keys", () => {
    const flat = flattenYahoo(standings);
    const leagues = extractLeagues(flat);
    const teams = extractTeams(flat);

    expect(leagues).toHaveLength(1);
    expect(leagues[0]).toMatchObject({
      leagueKey: "461.l.1000",
      name: "Gridiron",
      currentWeek: 6,
      numTeams: 2,
    });
    expect(teams.map((team) => team.name)).toEqual(["Home", "Away"]);
    expect(teams[0]?.managers).toEqual([
      { manager_id: "9", nickname: "Sam", is_commissioner: "1" },
    ]);
    expect(teams[0]?.faabBalance).toBe(42);
    expect(teams[0]?.standings).toMatchObject({
      rank: 1,
      wins: 4,
      losses: 1,
      pointsFor: "612.34",
    });
  });

  test("reads game weeks and stat categories", () => {
    const flat = flattenYahoo(gameWeeks);
    expect(extractGames(flat)[0]).toMatchObject({ gameKey: "461", code: "nfl", season: "2026" });
    expect(extractGameWeeks(flat)).toEqual([
      {
        week: 1,
        startDate: "2026-09-10",
        endDate: "2026-09-14",
        raw: { week: "1", start: "2026-09-10", end: "2026-09-14" },
      },
      {
        week: 2,
        startDate: "2026-09-15",
        endDate: "2026-09-21",
        raw: { week: "2", start: "2026-09-15", end: "2026-09-21" },
      },
    ]);

    const stats = flattenYahoo({
      fantasy_content: {
        game: [
          { game_key: "461", game_id: "461", code: "nfl", season: "2026", name: "Football" },
          {
            stat_categories: {
              stats: {
                "0": {
                  stat: {
                    stat_id: 4,
                    name: "Passing Yards",
                    display_name: "Pass Yds",
                    sort_order: "1",
                    position_type: "O",
                  },
                },
                count: 1,
              },
            },
          },
        ],
      },
    });
    expect(extractStatCategories(stats)).toMatchObject([
      { statId: 4, name: "Passing Yards", displayName: "Pass Yds", positionType: "O", sortOrder: 1 },
    ]);
  });

  test("keeps both eligible positions and season stats", () => {
    const [row] = extractPlayers(flattenYahoo(player));
    expect(row).toMatchObject({
      playerKey: "461.p.30121",
      name: "Christian McCaffrey",
      nflTeam: "SF",
      displayPosition: "RB",
      positions: ["RB", "W/R/T"],
      selectedPosition: "RB",
      ownershipType: "team",
      ownerTeamKey: "461.l.1000.t.1",
      percentOwned: "99",
      seasonPoints: "180.4",
      hasSeasonStats: true,
    });
    expect(row?.seasonStats).toEqual([{ statId: 4, value: "1200" }]);
  });

  test("reads a scoreboard when the team tuple contains empty arrays", () => {
    const rows = extractMatchups(
      flattenYahoo({
        fantasy_content: {
          league: [
            { league_key: "461.l.1000", name: "Gridiron", num_teams: 2 },
            {
              scoreboard: {
                "0": {
                  week: "1",
                  matchups: {
                    "0": {
                      matchup: {
                        "0": {
                          teams: {
                            "0": {
                              team: [
                                [
                                  { team_key: "461.l.1000.t.1" },
                                  { team_id: "1" },
                                  { name: "Home" },
                                  [],
                                  { url: "https://example.test/home" },
                                ],
                                {
                                  team_points: { total: "120.5" },
                                  team_projected_points: { total: "110.0" },
                                },
                              ],
                            },
                            "1": {
                              team: [
                                [
                                  { team_key: "461.l.1000.t.2" },
                                  { team_id: "2" },
                                  { name: "Away" },
                                  [],
                                ],
                                {
                                  team_points: { total: "98.0" },
                                  team_projected_points: { total: "105.0" },
                                },
                              ],
                            },
                            count: 2,
                          },
                        },
                        week: "1",
                        status: "postevent",
                        winner_team_key: "461.l.1000.t.1",
                      },
                    },
                    count: 1,
                  },
                },
                week: "1",
              },
            },
          ],
        },
      }),
    );
    expect(rows).toEqual([
      expect.objectContaining({
        teamKey: "461.l.1000.t.1",
        opponentTeamKey: "461.l.1000.t.2",
        points: "120.5",
        status: "postevent",
        week: 1,
        isWinner: true,
      }),
      expect.objectContaining({
        teamKey: "461.l.1000.t.2",
        opponentTeamKey: "461.l.1000.t.1",
        points: "98.0",
        isWinner: false,
      }),
    ]);
  });

  test("reads user leagues, matchups, draft picks, and transactions", () => {
    const leagues = extractLeagues(
      flattenYahoo({
        fantasy_content: {
          users: {
            "0": {
              user: [
                { guid: "ABC" },
                {
                  games: {
                    "0": {
                      game: [
                        {
                          game_key: "461",
                          game_id: "461",
                          name: "Football",
                          code: "nfl",
                          season: "2026",
                        },
                        {
                          leagues: {
                            "0": {
                              league: [
                                {
                                  league_key: "461.l.1000",
                                  league_id: "1000",
                                  name: "Gridiron",
                                  num_teams: 12,
                                  scoring_type: "head",
                                },
                              ],
                            },
                            count: 1,
                          },
                        },
                      ],
                    },
                    count: 1,
                  },
                },
              ],
            },
            count: 1,
          },
        },
      }),
    );
    expect(leagues.map((league) => league.name)).toEqual(["Gridiron"]);

    const matchupRows = extractMatchups(
      flattenYahoo({
        fantasy_content: {
          league: [
            {
              league_key: "461.l.1000",
              league_id: "1000",
              name: "Gridiron",
              num_teams: 2,
            },
            {
              scoreboard: [
                {
                  week: "1",
                  matchups: {
                    "0": {
                      matchup: {
                        week: "1",
                        status: "postevent",
                        winner_team_key: "461.l.1000.t.1",
                        teams: {
                          "0": {
                            team: [
                              [{ team_key: "461.l.1000.t.1" }, { team_id: "1" }, { name: "Home" }],
                              {
                                team_points: { total: "120.5" },
                                team_projected_points: { total: "110.0" },
                              },
                            ],
                          },
                          "1": {
                            team: [
                              [{ team_key: "461.l.1000.t.2" }, { team_id: "2" }, { name: "Away" }],
                              {
                                team_points: { total: "98.0" },
                                team_projected_points: { total: "105.0" },
                              },
                            ],
                          },
                          count: 2,
                        },
                      },
                    },
                    count: 1,
                  },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(matchupRows).toEqual([
      expect.objectContaining({
        teamKey: "461.l.1000.t.1",
        opponentTeamKey: "461.l.1000.t.2",
        points: "120.5",
        projectedPoints: "110.0",
        isWinner: true,
        week: 1,
      }),
      expect.objectContaining({
        teamKey: "461.l.1000.t.2",
        opponentTeamKey: "461.l.1000.t.1",
        points: "98.0",
        isWinner: false,
      }),
    ]);

    const picks = extractDraftPicks(
      flattenYahoo({
        fantasy_content: {
          league: [
            { league_key: "461.l.1000", league_id: "1000", name: "Gridiron", num_teams: 2 },
            {
              draft_results: {
                "0": {
                  draft_result: {
                    pick: "1",
                    round: "1",
                    team_key: "461.l.1000.t.1",
                    player_key: "461.p.30121",
                  },
                },
                count: 1,
              },
            },
          ],
        },
      }),
    );
    expect(picks).toMatchObject([
      { leagueKey: "461.l.1000", pick: 1, round: 1, playerKey: "461.p.30121" },
    ]);

    const moves = extractTransactions(
      flattenYahoo({
        fantasy_content: {
          league: [
            { league_key: "461.l.1000", league_id: "1000", name: "Gridiron", num_teams: 2 },
            {
              transactions: {
                "0": {
                  transaction: {
                    transaction_key: "461.l.1000.tr.26",
                    type: "add/drop",
                    status: "successful",
                    timestamp: "1577869389",
                    players: {
                      "0": {
                        player: [
                          [
                            { player_key: "461.p.30121" },
                            { name: { full: "Christian McCaffrey" } },
                          ],
                          {
                            transaction_data: {
                              type: "add",
                              source_type: "freeagents",
                              destination_type: "team",
                              destination_team_key: "461.l.1000.t.1",
                            },
                          },
                        ],
                      },
                      count: 1,
                    },
                  },
                },
                count: 1,
              },
            },
          ],
        },
      }),
    );
    expect(moves[0]).toMatchObject({
      transactionKey: "461.l.1000.tr.26",
      leagueKey: "461.l.1000",
      type: "add/drop",
      players: [
        {
          playerKey: "461.p.30121",
          name: "Christian McCaffrey",
          type: "add",
          destinationTeamKey: "461.l.1000.t.1",
        },
      ],
    });
    expect(moves[0]?.timestamp?.getTime()).toBe(1577869389 * 1000);
  });

  test("normalizes fantasy paths", () => {
    expect(normalizeYahooPath("/league/461.l.123/scoreboard;week=3")).toBe(
      "league/461.l.123/scoreboard;week=3",
    );
    expect(
      normalizeYahooPath(
        "https://fantasysports.yahooapis.com/fantasy/v2/game/nfl?format=xml",
      ),
    ).toBe("game/nfl");
    expect(() => normalizeYahooPath("../secret")).toThrow();
  });
});
