import { describe, expect, test } from "bun:test";
import { slotFor } from "./schedule";

describe("publish slots", () => {
  test("uses eastern daylight time before the November change", () => {
    expect(slotFor("2026-10-05", "results").toISOString()).toBe("2026-10-06T13:00:00.000Z");
    expect(slotFor("2026-10-05", "recap").toISOString()).toBe("2026-10-06T14:00:00.000Z");
    expect(slotFor("2026-10-05", "rankings").toISOString()).toBe("2026-10-07T14:00:00.000Z");
    expect(slotFor("2026-10-05", "waivers").toISOString()).toBe("2026-10-09T13:00:00.000Z");
  });

  test("uses eastern standard time after the week that crosses the change", () => {
    expect(slotFor("2026-11-02", "results").toISOString()).toBe("2026-11-03T14:00:00.000Z");
    expect(slotFor("2026-11-02", "recap").toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(slotFor("2026-11-02", "rankings").toISOString()).toBe("2026-11-04T15:00:00.000Z");
    expect(slotFor("2026-11-02", "waivers").toISOString()).toBe("2026-11-06T14:00:00.000Z");
  });
});
