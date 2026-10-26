import { describe, expect, test } from "bun:test";
import type { BriefSide, WeekBrief } from "../recap/types";
import { auditOutline } from "./audit";
import { planSegments } from "./budget";
import type { OutlineSection, PodcastOutline } from "./types";

const plan = planSegments(brief(), null);

describe("auditOutline", () => {
  test("accepts a plan that cites only the sheet", () => {
    expect(auditOutline(plan, outline()).ok).toBe(true);
  });

  test("rejects a section list that does not match the plan", () => {
    const draft = outline();
    draft.sections[0] = { ...draft.sections[0]!, id: "intro" };
    const result = auditOutline(plan, draft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join("\n")).toContain("do not match the plan");
  });

  test("rejects an invented number and identical stances", () => {
    const invented = outline();
    invented.sections[1] = { ...invented.sections[1]!, angle: "Wolves scored 999." };
    const inventedResult = auditOutline(plan, invented);
    expect(inventedResult.ok).toBe(false);
    if (!inventedResult.ok) expect(inventedResult.errors.join("\n")).toContain("Invented number 999");

    const same = outline();
    same.sections[0] = { ...same.sections[0]!, greg: same.sections[0]!.jerry };
    const sameResult = auditOutline(plan, same);
    expect(sameResult.ok).toBe(false);
    if (!sameResult.ok) expect(sameResult.errors.join("\n")).toContain("different stances");
  });
});

function outline(): PodcastOutline {
  const sections: OutlineSection[] = plan.map((segment, index) => ({
    id: segment.id,
    angle: "Wolves scored 120.",
    jerry: "Wolves are the better club.",
    greg: "Bench is closer than that score.",
    facts: ["Wolves scored 120."],
    handoff: index === plan.length - 1 ? "" : "Bench is next.",
  }));
  return {
    title: "Wolves pull away",
    description: "Wolves scored 120 and Bench scored 110.",
    sections,
  };
}

function brief(): WeekBrief {
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
    ],
    transactions: [],
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
