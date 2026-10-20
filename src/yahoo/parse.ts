const SKIP_KEYS = new Set([
  "count",
  "xml:lang",
  "yahoo:uri",
  "time",
  "copyright",
  "refresh_rate",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function str(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function int(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

export function numString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return value.trim();
  }
  return null;
}

export function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

export function walk(node: unknown, visit: (record: Record<string, unknown>) => void) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (!isRecord(node)) return;
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

export function contentOf(flat: unknown): Record<string, unknown> {
  if (!isRecord(flat)) return {};
  return isRecord(flat.fantasy_content) ? flat.fantasy_content : flat;
}

/**
 * Yahoo's JSON keeps collections as `{"0": {...}, "count": N}` and resource
 * metadata as arrays of single-key objects. This turns both into plain objects
 * and arrays.
 */
export function flattenYahoo(node: unknown): unknown {
  if (Array.isArray(node)) {
    if (isUniqueSingleKeyObjects(node)) {
      return flattenYahoo(mergeSingleKeyObjects(node));
    }
    if (isResourceTuple(node)) {
      const merged: Record<string, unknown> = {};
      for (const part of node.map((item) => flattenYahoo(item))) {
        if (isRecord(part)) Object.assign(merged, part);
      }
      return merged;
    }
    const flattened = node.map((item) => flattenYahoo(item));
    if (
      flattened.length === 1 &&
      isRecord(flattened[0]) &&
      Object.keys(flattened[0]).length === 1
    ) {
      return flattened[0];
    }
    return flattened;
  }

  if (!isRecord(node)) return node;

  if (isNumericCollection(node)) {
    const count = Number(node.count);
    const indexes = Object.keys(node)
      .filter((key) => /^\d+$/.test(key))
      .sort((left, right) => Number(left) - Number(right));
    const selected = Number.isFinite(count) && count >= 0 ? indexes.slice(0, count) : indexes;
    return selected.map((key) => unwrapResource(flattenYahoo(node[key])));
  }

  const flattened: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) continue;
    flattened[key] = flattenYahoo(value);
  }
  return flattened;
}

function isNumericCollection(node: Record<string, unknown>): boolean {
  if (!("count" in node)) return false;
  const keys = Object.keys(node).filter((key) => key !== "count");
  if (keys.length === 0) return Number(node.count) === 0;
  return keys.every((key) => /^\d+$/.test(key));
}

function isUniqueSingleKeyObjects(node: unknown[]): node is Record<string, unknown>[] {
  if (node.length === 0 || !node.every(isRecord)) return false;
  if (!node.every((item) => Object.keys(item).length === 1)) return false;
  const keys = node.map((item) => Object.keys(item)[0]);
  return new Set(keys).size === keys.length;
}

function mergeSingleKeyObjects(node: Record<string, unknown>[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const item of node) {
    const [key, value] = Object.entries(item)[0];
    merged[key] = value;
  }
  return merged;
}

function isResourceTuple(node: unknown[]): boolean {
  if (node.length < 2) return false;
  const [first, ...rest] = node;
  if (!rest.every(isRecord)) return false;
  if (Array.isArray(first)) return true;
  if (!isRecord(first) || Object.keys(first).length < 2) return false;
  return rest.every((item) => Object.keys(item).length === 1);
}

function unwrapResource(node: unknown): unknown {
  if (!isRecord(node)) return node;
  const keys = Object.keys(node);
  if (keys.length !== 1) return node;
  return node[keys[0]];
}

export function normalizeYahooPath(input: string): string {
  let path = input.trim();
  const prefix = "https://fantasysports.yahooapis.com/fantasy/v2/";
  if (path.startsWith(prefix)) path = path.slice(prefix.length);
  path = path.replace(/^\//, "").replace(/\?.*$/, "");
  if (!path || path.includes("..") || path.includes("://") || path.startsWith("//")) {
    throw new Error(
      'Pass a fantasy/v2 path such as "/league/461.l.123/scoreboard;week=3". Quote paths that contain ";".',
    );
  }
  return path;
}

export function leagueKeyFromPath(path: string): string | null {
  const league = path.match(/(?:^|\/)league\/([^/;]+)/);
  if (league) return league[1];
  const team = path.match(/(?:^|\/)team\/([^/;]+)/);
  if (team) return team[1].replace(/\.t\.[^.]+$/, "");
  return null;
}

export function weekFromPath(path: string): number | null {
  const match = path.match(/(?:^|;)week=(\d+)/);
  return match ? Number(match[1]) : null;
}

export function teamKeyFromPath(path: string): string | null {
  const match = path.match(/(?:^|\/)team\/([^/;]+)/);
  return match?.[1] ?? null;
}

export function gameKeyFromPath(path: string): string | null {
  const match = path.match(/^game\/([^/]+)/);
  return match?.[1] ?? null;
}
