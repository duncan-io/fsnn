import { describe, expect, test } from "bun:test";
import { adminReturnUrl } from "./status";

describe("admin return url", () => {
  test("returns to the public admin page after Yahoo", () => {
    const url = adminReturnUrl("https://fsnn-production.up.railway.app/admin/yahoo/callback", {
      notice: "connected",
    });
    expect(url.toString()).toBe("https://fsnn-production.up.railway.app/admin?notice=connected");
  });

  test("keeps a local redirect origin and drops empty params", () => {
    const url = adminReturnUrl("http://127.0.0.1:3000/admin/yahoo/callback", {
      error: "session",
      detail: "",
    });
    expect(url.toString()).toBe("http://127.0.0.1:3000/admin?error=session");
  });
});
