import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "./password";

describe("reader passwords", () => {
  test("accepts the password that was hashed", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  test("rejects a stored value that is not a hash", async () => {
    expect(await verifyPassword("correct horse", "")).toBe(false);
    expect(await verifyPassword("correct horse", "no-separator")).toBe(false);
    expect(await verifyPassword("correct horse", ".abc")).toBe(false);
  });
});
