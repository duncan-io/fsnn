import { describe, expect, test } from "bun:test";
import { extractWeekStats } from "./extract";

describe("week stats", () => {
  test("keeps week coverage and ignores season coverage", () => {
    const rows = extractWeekStats({
      fantasy_content: {
        player: {
          player_key: "461.p.1",
          player_stats: {
            coverage_type: "week",
            stats: [{ stat: { stat_id: "4", value: "8" } }],
          },
        },
      },
    });
    expect(rows).toEqual([{ playerKey: "461.p.1", stats: [{ statId: 4, value: "8" }] }]);
    expect(
      extractWeekStats({
        player_key: "461.p.2",
        player_stats: { coverage_type: "season", stats: [{ stat: { stat_id: "4", value: "80" } }] },
      }),
    ).toEqual([]);
  });
});
