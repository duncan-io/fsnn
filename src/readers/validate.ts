const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME = /^[\p{L}\p{N}](?:[\p{L}\p{N}.' -]*[\p{L}\p{N}.])?$/u;
const STORY_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  if (!EMAIL.test(email)) return null;
  return email;
}

export function normalizeDisplayName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 24) return null;
  if (!DISPLAY_NAME.test(name)) return null;
  return name;
}

export function displayKey(name: string) {
  return name.toLowerCase();
}

export function normalizePassword(value: string) {
  if (value.length < 8 || value.length > 200) return null;
  return value;
}

export function normalizeComment(value: string) {
  const body = value.replaceAll("\u0000", "").trim();
  if (body.length < 1 || body.length > 500) return null;
  return body;
}

export function isStorySlug(value: string) {
  return value.length > 0 && value.length <= 120 && STORY_SLUG.test(value);
}

/** Same-site path only. Anything else falls back so `next` cannot leave the site. */
export function safeNextPath(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;
  if (value.length === 0 || value.length > 200) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\") || value.includes("://") || value.includes("..")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(value)) return fallback;
  return value;
}
