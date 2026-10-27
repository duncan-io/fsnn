import { describe, expect, test } from "bun:test";
import type { BriefSide, WeekBrief } from "../recap/types";
import { planSegments } from "./budget";
import { EMPTY_DESK, type DeskContext } from "./desk";
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

  test("pins one desk card on the section that can use it", () => {
    const empty = planSegments(brief(false), null, EMPTY_DESK);
    for (const segment of empty) expect(segment.facts).not.toHaveProperty("desk");

    const plan = planSegments(brief(true), preview(), sampleDesk());
    expect(deskOf(plan, "recap:a:b")).toMatchObject({ headline: "Wolves pull away" });
    expect(plan.find((segment) => segment.id === "recap:c:d")?.facts).not.toHaveProperty("desk");
    expect(deskOf(plan, "open")).toMatchObject({ week: 5 });
    expect(deskOf(plan, "close")).toMatchObject({ week: 5 });
    expect(deskOf(plan, "preview:a:b")).toMatchObject({
      rankings: [{ teamName: "Wolves" }, { teamName: "Bench" }],
      column: { claim: "Wolves are the club to beat." },
    });
    expect(deskOf(plan, "wire")).toMatchObject({ desk: "waivers", claim: "Hail should spend the budget." });
  });
});

function deskOf(plan: ReturnType<typeof planSegments>, id: string): unknown {
  const facts = plan.find((segment) => segment.id === id)?.facts;
  if (!facts || typeof facts !== "object" || !("desk" in facts)) throw new Error(`Missing desk on ${id}`);
  return facts.desk;
}

function sampleDesk(): DeskContext {
  return {
    recaps: [
      {
        matchupKey: "a:b",
        writer: "Kevin Marsh",
        headline: "Wolves pull away",
        dek: "A late score",
        heading: "Wolves hold on",
        sentence: "Wolves scored 120.",
        teamNames: ["Wolves", "Bench"],
      },
    ],
    rankings: [
      { week: 5, writer: "Ada Quinn", headline: "Order", teamKey: "a", teamName: "Wolves", sentence: "Wolves scored 120." },
      { week: 5, writer: "Ada Quinn", headline: "Order", teamKey: "b", teamName: "Bench", sentence: "Bench scored 110." },
      { week: 5, writer: "Ada Quinn", headline: "Order", teamKey: "c", teamName: "Hail", sentence: "Hail scored 100." },
    ],
    columns: [
      {
        writer: "Greg Pell",
        desk: "results",
        headline: "Wolves are the club to beat",
        claim: "Wolves are the club to beat.",
        counter: "Bench scored 110.",
        teamKeys: ["a"],
        teamNames: ["Wolves"],
        week: 6,
      },
      {
        writer: "Jerry Crowe",
        desk: "waivers",
        headline: "Hail should spend",
        claim: "Hail should spend the budget.",
        counter: "The wire is thin.",
        teamKeys: ["c"],
        teamNames: ["Hail"],
        week: 6,
      },
    ],
    lastShow: {
      week: 5,
      title: "The Dig, Week 5: Bench is fine",
      sections: [{ angle: "Wolves are ahead.", jerry: "Wolves are the better club.", greg: "Bench is closer." }],
    },
  };
}

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
