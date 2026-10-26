import { describe, expect, test } from "bun:test";
import { activityNotes } from "./notes";

const start = "2026-10-14";
const end = "2026-10-20";

describe("activityNotes", () => {
  test("keeps a winning waiver add and a trade inside the week", () => {
    const notes = activityNotes(
      [
        {
          type: "add",
          status: "successful",
          timestamp: new Date("2026-10-16T15:00:00.000Z"),
          faabBid: 12,
          players: [{ name: "Rookie Back", type: "add", destinationTeamKey: "wolves" }],
        },
        {
          type: "trade",
          status: "successful",
          timestamp: new Date("2026-10-17T15:00:00.000Z"),
          faabBid: null,
          players: [{ name: "Star Wideout", type: "add", destinationTeamKey: "wolves" }],
        },
        {
          type: "add",
          status: "successful",
          timestamp: new Date("2026-10-21T15:00:00.000Z"),
          faabBid: 40,
          players: [{ name: "Late Add", type: "add", destinationTeamKey: "wolves" }],
        },
        {
          type: "add",
          status: "pending",
          timestamp: new Date("2026-10-16T18:00:00.000Z"),
          faabBid: 8,
          players: [{ name: "Lost Bid", type: "add", destinationTeamKey: "bench" }],
        },
      ],
      start,
      end,
    );

    expect(notes.get("wolves")).toBe("Added Rookie Back for 12. Traded for Star Wideout.");
    expect(notes.has("bench")).toBe(false);
  });
});
