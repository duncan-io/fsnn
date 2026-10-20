import { describe, expect, test } from "bun:test";
import { classifyYahooPath } from "./ingest";
import { weekFromPath } from "./parse";

describe("roster paths", () => {
  test("treats a week roster with player points as a roster", () => {
    const path = "team/461.l.1000.t.1/roster;week=3/players;out=player_points";
    expect(classifyYahooPath(path)).toBe("roster");
    expect(weekFromPath(path)).toBe(3);
  });
});
