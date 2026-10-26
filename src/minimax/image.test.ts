import { describe, expect, test } from "bun:test";
import { illustrationPrompt, readIllustration } from "./image";

describe("illustrationPrompt", () => {
  test("keeps the story and the constraints inside the MiniMax limit", () => {
    const prompt = illustrationPrompt("Wolves pull away", "A late surge decides week 6.");
    expect(prompt).toContain("Wolves pull away");
    expect(prompt).toContain("A late surge decides week 6.");
    expect(prompt).toContain("No readable text");
    expect(prompt).toContain("no likeness of a real athlete");
    expect(prompt.length).toBeLessThanOrEqual(1500);
  });

  test("drops overflow from a long dek without cutting the instructions", () => {
    const prompt = illustrationPrompt("Short", "x".repeat(4000));
    expect(prompt.startsWith("Editorial illustration")).toBe(true);
    expect(prompt).toContain("No readable text");
    expect(prompt.length).toBeLessThanOrEqual(1500);
  });
});

describe("readIllustration", () => {
  test("reads the first base64 picture", () => {
    expect(
      readIllustration({
        base_resp: { status_code: 0, status_msg: "success" },
        data: { image_base64: ["abc", "def"] },
      }),
    ).toBe("abc");
  });

  test("rejects a MiniMax error and an empty picture", () => {
    expect(() => readIllustration({ base_resp: { status_code: 1004, status_msg: "bad sk-secret request" } })).toThrow(
      /\[key\]/,
    );
    expect(() => readIllustration({ data: { image_base64: [] } })).toThrow(/no picture/);
  });
});
