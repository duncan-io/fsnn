const ARTICLE_IMAGE_KEY = /^articles\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/;

export function articleImageKey(slug: string): string {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!safe) throw new Error("Article slug cannot be used as an image name.");
  return `articles/${safe}.jpg`;
}

export function isArticleImageKey(key: string): boolean {
  return ARTICLE_IMAGE_KEY.test(key);
}

export function mediaPath(imageKey: string | null | undefined): string | undefined {
  if (!imageKey || !isArticleImageKey(imageKey)) return undefined;
  return `/media/${imageKey}`;
}

export function imageKeyFromPath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }
  const key = segments.join("/");
  return isArticleImageKey(key) ? key : null;
}
