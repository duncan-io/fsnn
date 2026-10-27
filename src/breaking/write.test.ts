import { describe, expect, test } from "bun:test";
import { reviewBreaking } from "./write";

const brief = [
  "Waiver Wire Wolves traded for Patrick Mahomes.",
  "Sleeper Cell sent Patrick Mahomes.",
  "Patrick Mahomes has 210.2 season points.",
  "Waiver Wire Wolves is 6-1 and ranked 1.",
].join("\n");

describe("reviewBreaking", () => {
  test("accepts two paragraphs that stay inside the brief", () => {
    const errors = reviewBreaking(
      {
        headline: "Wolves trade for Patrick Mahomes",
        dek: "Sleeper Cell sent the quarterback.",
        paragraphs: [
          "Waiver Wire Wolves traded for Patrick Mahomes.",
          "Patrick Mahomes has 210.2 season points, and Waiver Wire Wolves is 6-1.",
        ],
      },
      brief,
    );
    expect(errors).toEqual([]);
  });

  test("rejects an extra paragraph and a number that is not in the brief", () => {
    const errors = reviewBreaking(
      {
        headline: "Wolves trade for Patrick Mahomes",
        dek: "The bid was 40.",
        paragraphs: ["One.", "Two.", "Three."],
      },
      brief,
    );
    expect(errors.some((error) => error.includes("two paragraphs"))).toBe(true);
    expect(errors.some((error) => error.includes("40"))).toBe(true);
  });
});
