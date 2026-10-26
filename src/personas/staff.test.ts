import { describe, expect, test } from "bun:test";
import { assignPersona, type Desk } from "./staff";

const fixed: Array<[Desk, "mike" | "kevin"]> = [
  ["power-rankings", "mike"],
  ["breaking", "mike"],
  ["interview", "kevin"],
  ["preview", "kevin"],
];

const openDesks: Desk[] = ["weekly-recap", "analysis", "results", "waivers"];

describe("assignPersona", () => {
  test("gives Mike and Kevin their desks no matter the seed", () => {
    for (const [desk, id] of fixed) {
      expect(assignPersona(desk, "a").id).toBe(id);
      expect(assignPersona(desk, "another-seed").id).toBe(id);
    }
  });

  test("gives open desks only Jerry, Greg, or Frank", () => {
    for (const desk of openDesks) {
      const ids = new Set<string>();
      for (let i = 0; i < 90; i += 1) {
        ids.add(assignPersona(desk, `league:${i}:${desk}`).id);
      }
      expect(ids).toEqual(new Set(["jerry", "greg", "frank"]));
    }
  });

  test("repeats the same writer for the same seed", () => {
    for (const desk of [...openDesks, ...fixed.map(([desk]) => desk)]) {
      const first = assignPersona(desk, "461.l.12345:7:story");
      expect(assignPersona(desk, "461.l.12345:7:story")).toBe(first);
    }
  });
});
