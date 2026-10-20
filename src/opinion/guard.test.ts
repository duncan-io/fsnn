import { describe, expect, test } from "bun:test";
import { columnProse, parseColumn, slugifyColumn } from "./copy";
import { briefText, unexpectedNumbers } from "./guard";

describe("unexpectedNumbers", () => {
  const brief = briefText({
    leagueName: "Guild",
    week: 7,
    claim: "Wolves are 6-1 and ranked 1.",
    evidence: ["Wolves scored 100.0 points."],
    counterEvidence: ["Opponents scored 80.5 points."],
  });

  test("allows a number that appears in the brief, including an equivalent decimal", () => {
    expect(unexpectedNumbers("Week 7. Wolves are 6-1 with 100 points.", brief)).toEqual([]);
  });

  test("rejects a rounded figure that is not the brief's number", () => {
    expect(unexpectedNumbers("They scored 100.4 and also 80.", brief)).toEqual(["100.4", "80"]);
  });

  test("rejects a digit sliced out of a larger number", () => {
    expect(unexpectedNumbers("A 6 point problem.", briefText({
      leagueName: "Guild",
      week: 7,
      claim: "Ranked 16.",
      evidence: [],
      counterEvidence: [],
    }))).toEqual(["6"]);
  });
});

describe("parseColumn", () => {
  test("reads fenced JSON and ignores a thinking trace", () => {
    const copy = parseColumn(`<think>draft</think>
\`\`\`json
{"headline":"Wolves are frauds","dek":"The record is loud.","paragraphs":["First.","Second."]}
\`\`\``);
    expect(copy.headline).toBe("Wolves are frauds");
    expect(columnProse(copy)).toContain("The record is loud.");
  });

  test("rejects a column with no paragraphs", () => {
    expect(() => parseColumn(`{"headline":"Hi","dek":"There","paragraphs":[]}`)).toThrow();
  });
});

describe("slugifyColumn", () => {
  test("builds a stable slug from the headline, week, and desk", () => {
    expect(slugifyColumn("Wolves are frauds!", 7, "results")).toBe("wolves-are-frauds-w7-results");
  });
});
