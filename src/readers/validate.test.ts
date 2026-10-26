import { describe, expect, test } from "bun:test";
import {
  displayKey,
  isStorySlug,
  normalizeComment,
  normalizeDisplayName,
  normalizeEmail,
  normalizePassword,
  safeNextPath,
} from "./validate";

describe("reader fields", () => {
  test("normalizes an email and rejects a missing domain", () => {
    expect(normalizeEmail("  Reader@Example.com ")).toBe("reader@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });

  test("keeps a display name between 2 and 24 characters", () => {
    expect(normalizeDisplayName("  Al  ")).toBe("Al");
    expect(normalizeDisplayName("O'Brien")).toBe("O'Brien");
    expect(displayKey("O'Brien")).toBe("o'brien");
    expect(normalizeDisplayName("A")).toBeNull();
    expect(normalizeDisplayName("a".repeat(25))).toBeNull();
    expect(normalizeDisplayName("has_underscore")).toBeNull();
  });

  test("requires a password of at least 8 characters", () => {
    expect(normalizePassword("short")).toBeNull();
    expect(normalizePassword("long-enough")).toBe("long-enough");
  });

  test("trims a comment and keeps it within 500 characters", () => {
    expect(normalizeComment("  nice win  ")).toBe("nice win");
    expect(normalizeComment("   ")).toBeNull();
    expect(normalizeComment("a".repeat(501))).toBeNull();
    expect(normalizeComment("ok\u0000")).toBe("ok");
  });

  test("accepts story slugs and rejects anything else", () => {
    expect(isStorySlug("week-8-lock-thursday")).toBe(true);
    expect(isStorySlug("wolves-are-frauds-w7-results")).toBe(true);
    expect(isStorySlug("../etc")).toBe(false);
    expect(isStorySlug("")).toBe(false);
  });
});

describe("safeNextPath", () => {
  test("keeps a same-site story path", () => {
    expect(safeNextPath("/articles/week-8-lock-thursday")).toBe("/articles/week-8-lock-thursday");
  });

  test("rejects an off-site next path", () => {
    expect(safeNextPath("https://evil.example/phish")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/articles/../../admin")).toBe("/");
    expect(safeNextPath("articles/week-8")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
