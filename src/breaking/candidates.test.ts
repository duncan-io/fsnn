import { describe, expect, test } from "bun:test";
import {
  decideBreaking,
  pickBreaking,
  scoreBreaking,
  type BreakingClub,
  type BreakingStarter,
  type BreakingTransaction,
} from "./candidates";

const wolves: BreakingClub = {
  teamKey: "t.wolves",
  teamName: "Waiver Wire Wolves",
  wins: 6,
  losses: 1,
  ties: 0,
  rank: 1,
};

const sleeper: BreakingClub = {
  teamKey: "t.sleeper",
  teamName: "Sleeper Cell",
  wins: 4,
  losses: 3,
  ties: 0,
  rank: 5,
};

function trade(partial: Partial<BreakingTransaction> = {}): BreakingTransaction {
  return {
    transactionKey: "tr.1",
    type: "trade",
    status: "successful",
    timestamp: new Date("2026-10-20T15:00:00.000Z"),
    faabBid: null,
    players: [
      {
        name: "Patrick Mahomes",
        type: "add",
        sourceTeamKey: sleeper.teamKey,
        destinationTeamKey: wolves.teamKey,
        playerKey: "p.mahomes",
      },
    ],
    ...partial,
  };
}

function add(bid: number, status = "successful"): BreakingTransaction {
  return {
    transactionKey: `tr.bid.${bid}`,
    type: "add/drop",
    status,
    timestamp: new Date("2026-10-21T12:00:00.000Z"),
    faabBid: bid,
    players: [
      {
        name: "Christian McCaffrey",
        type: "add",
        sourceTeamKey: null,
        destinationTeamKey: wolves.teamKey,
        playerKey: "p.cmc",
      },
      {
        name: "Kicker",
        type: "drop",
        sourceTeamKey: wolves.teamKey,
        destinationTeamKey: null,
        playerKey: "p.k",
      },
    ],
  };
}

function starter(partial: Partial<BreakingStarter> = {}): BreakingStarter {
  return {
    playerKey: "p.star",
    name: "CeeDee Lamb",
    teamKey: wolves.teamKey,
    selectedPosition: "WR",
    status: "O",
    injuryNote: "ankle",
    seasonPoints: 142.36,
    ...partial,
  };
}

const clubs = [wolves, sleeper];

describe("scoreBreaking", () => {
  test("a trade outranks a minimum waiver bid", () => {
    const scored = scoreBreaking({
      transactions: [trade(), add(12)],
      starters: [],
      clubs,
      seasonPoints: new Map([["p.mahomes", 210.2]]),
    });
    const deal = scored.find((item) => item.kind === "trade");
    const claim = scored.find((item) => item.kind === "add");
    expect(deal?.heat).toBe(65);
    expect(deal?.sourceKey).toBe("trade:tr.1");
    expect(deal?.lines.join(" ")).toContain("Waiver Wire Wolves traded for Patrick Mahomes.");
    expect(deal?.lines.join(" ")).toContain("Sleeper Cell sent Patrick Mahomes.");
    expect(deal?.lines.join(" ")).toContain("210.2");
    expect(deal?.lines.join(" ")).toContain("6-1");
    expect(claim?.heat).toBe(12);
    expect(claim?.sourceKey).toBe("add:tr.bid.12");
    expect(pickBreaking(scored, new Set())?.sourceKey).toBe("trade:tr.1");
  });

  test("counts every player added in a trade", () => {
    const scored = scoreBreaking({
      transactions: [
        trade({
          players: [
            {
              name: "Patrick Mahomes",
              type: "add",
              sourceTeamKey: sleeper.teamKey,
              destinationTeamKey: wolves.teamKey,
              playerKey: "p.mahomes",
            },
            {
              name: "Tyreek Hill",
              type: "add",
              sourceTeamKey: wolves.teamKey,
              destinationTeamKey: sleeper.teamKey,
              playerKey: "p.hill",
            },
            {
              name: "Bench Back",
              type: "drop",
              sourceTeamKey: wolves.teamKey,
              destinationTeamKey: null,
              playerKey: "p.bench",
            },
          ],
        }),
      ],
      starters: [],
      clubs,
      seasonPoints: new Map(),
    });
    expect(scored[0]?.heat).toBe(70);
    expect(scored[0]?.teamKeys).toEqual(["t.sleeper", "t.wolves"]);
  });

  test("a large bid outranks a one-player trade", () => {
    const scored = scoreBreaking({
      transactions: [trade(), add(80)],
      starters: [],
      clubs,
      seasonPoints: new Map(),
    });
    expect(pickBreaking(scored, new Set())?.sourceKey).toBe("add:tr.bid.80");
  });

  test("ignores a bid under the floor, a drop, and a pending trade", () => {
    const drop: BreakingTransaction = {
      transactionKey: "tr.drop",
      type: "drop",
      status: "successful",
      timestamp: null,
      faabBid: 20,
      players: [
        {
          name: "Kicker",
          type: "drop",
          sourceTeamKey: wolves.teamKey,
          destinationTeamKey: null,
          playerKey: "p.k",
        },
      ],
    };
    const scored = scoreBreaking({
      transactions: [add(11), drop, trade({ status: "pending" })],
      starters: [],
      clubs,
      seasonPoints: new Map(),
    });
    expect(scored).toEqual([]);
  });

  test("scores a starter who is out and skips the bench and the IR slot", () => {
    const scored = scoreBreaking({
      transactions: [],
      starters: [
        starter(),
        starter({ playerKey: "p.bench", name: "Bench Back", selectedPosition: "BN", status: "O" }),
        starter({ playerKey: "p.ir", name: "Reserve Back", selectedPosition: "IR", status: "IR" }),
        starter({ playerKey: "p.empty", name: "Unset Back", selectedPosition: null, status: "O" }),
      ],
      clubs,
      seasonPoints: new Map(),
    });
    expect(scored).toHaveLength(1);
    expect(scored[0]?.heat).toBe(36);
    expect(scored[0]?.sourceKey).toBe("injury:p.star:O:ankle");
    expect(scored[0]?.lines.join(" ")).toContain("CeeDee Lamb is out.");
    expect(scored[0]?.lines.join(" ")).toContain("Injury: ankle.");
    expect(scored[0]?.lines.join(" ")).toContain("142.4");
  });

  test("a questionable starter and a note score below an out designation", () => {
    const scored = scoreBreaking({
      transactions: [],
      starters: [
        starter({ playerKey: "p.q", name: "Questionable Back", status: "Q", injuryNote: null, seasonPoints: null }),
        starter({ playerKey: "p.note", name: "Noted Back", status: null, injuryNote: "hamstring", seasonPoints: null }),
      ],
      clubs,
      seasonPoints: new Map(),
    });
    expect(scored.map((item) => item.heat).sort()).toEqual([24, 24]);
    expect(scored.map((item) => item.sourceKey).sort()).toEqual([
      "injury:p.note::hamstring",
      "injury:p.q:Q:",
    ]);
  });

  test("breaks a heat tie on the source key", () => {
    const scored = scoreBreaking({
      transactions: [],
      starters: [
        starter({ playerKey: "p.b", name: "Bee Back", status: "O", injuryNote: null, seasonPoints: null }),
        starter({ playerKey: "p.a", name: "Aye Back", status: "O", injuryNote: null, seasonPoints: null }),
      ],
      clubs,
      seasonPoints: new Map(),
    });
    expect(pickBreaking(scored, new Set())?.sourceKey).toBe("injury:p.a:O:");
    expect(pickBreaking(scored, new Set(["injury:p.a:O:"]))?.sourceKey).toBe("injury:p.b:O:");
  });
});

describe("decideBreaking", () => {
  const candidate = scoreBreaking({
    transactions: [trade()],
    starters: [],
    clubs,
    seasonPoints: new Map(),
  })[0];

  test("the first run baselines every candidate and writes nothing", () => {
    expect(
      decideBreaking({
        initialized: false,
        candidates: [candidate],
        seen: new Set(),
        publishedLastDay: 0,
      }),
    ).toEqual({ action: "baseline", candidates: [candidate] });
  });

  test("a quiet league stays quiet", () => {
    expect(
      decideBreaking({
        initialized: true,
        candidates: [],
        seen: new Set(),
        publishedLastDay: 0,
      }),
    ).toEqual({ action: "quiet" });
  });

  test("two stories in a day hold the next one", () => {
    expect(
      decideBreaking({
        initialized: true,
        candidates: [candidate],
        seen: new Set(),
        publishedLastDay: 2,
      }).action,
    ).toBe("capped");
  });

  test("an unseen candidate publishes when the day is open", () => {
    const decision = decideBreaking({
      initialized: true,
      candidates: [candidate],
      seen: new Set(),
      publishedLastDay: 1,
    });
    expect(decision).toEqual({ action: "publish", candidate });
  });
});
