import { describe, expect, test } from "bun:test";
import { createSessionValue, passwordsMatch, sameSecret, sessionIsValid } from "./session";

describe("admin session", () => {
  test("compares passwords without treating a shorter guess as a match", () => {
    expect(passwordsMatch("correct horse", "correct horse")).toBe(true);
    expect(passwordsMatch("nope", "correct horse")).toBe(false);
    expect(passwordsMatch("", "correct horse")).toBe(false);
  });

  test("accepts a signed session until it expires", () => {
    const now = Date.parse("2026-10-20T15:00:00Z");
    const value = createSessionValue("secret", now);
    expect(sessionIsValid(value, "secret", now + 1000)).toBe(true);
    expect(sessionIsValid(value, "other", now + 1000)).toBe(false);
    expect(sessionIsValid(value, "secret", now + 12 * 60 * 60 * 1000)).toBe(false);
    expect(sessionIsValid("1.not-a-signature", "secret", now)).toBe(false);
    expect(sessionIsValid(undefined, "secret", now)).toBe(false);
  });

  test("rejects an empty OAuth state", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abc", "abd")).toBe(false);
    expect(sameSecret("", "")).toBe(false);
  });
});
