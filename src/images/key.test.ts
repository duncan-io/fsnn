import { describe, expect, test } from "bun:test";
import { articleImageKey, imageKeyFromPath, isArticleImageKey, mediaPath } from "./key";

describe("article image keys", () => {
  test("turns a slug into a bucket key and a media path", () => {
    const key = articleImageKey("Week 6: Wolves!");
    expect(key).toBe("articles/week-6-wolves.jpg");
    expect(isArticleImageKey(key)).toBe(true);
    expect(mediaPath(key)).toBe("/media/articles/week-6-wolves.jpg");
  });

  test("rejects empty slugs and keys outside the articles folder", () => {
    expect(() => articleImageKey("---")).toThrow(/image name/);
    expect(mediaPath(null)).toBeUndefined();
    expect(mediaPath("other/week-6.jpg")).toBeUndefined();
    expect(imageKeyFromPath(["articles", "..", "secret.jpg"])).toBeNull();
    expect(imageKeyFromPath(["articles", "week-6-wolves.jpg"])).toBe("articles/week-6-wolves.jpg");
  });
});
