import type { StatLine } from "./types";

export function rosterSlots(value: unknown): string[] {
  const slots: string[] = [];
  const seen = new Set<unknown>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const record = node as Record<string, unknown>;
    const nested = record.roster_position;
    if (nested && typeof nested === "object") visit(nested);
    const position = record.position;
    if (typeof position === "string" && position.trim()) {
      const count = typeof record.count === "number" ? record.count : Number(record.count);
      const times = Number.isFinite(count) && count > 1 ? ` x${count}` : "";
      slots.push(`${position.trim()}${times}`);
    }
    for (const child of Object.values(record)) {
      if (child && typeof child === "object") visit(child);
    }
  };
  visit(value);
  return [...new Set(slots)];
}

export function playoffTeamCount(settings: unknown): number | null {
  let found: number | null = null;
  const seen = new Set<unknown>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "num_playoff_teams" || key === "playoff_teams") {
        const parsed = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(parsed) && parsed > 0) found = parsed;
      } else if (value && typeof value === "object") visit(value);
    }
  };
  visit(settings);
  return found;
}

export function labelStats(
  rows: Array<{ statId: number; value: string | number | null }>,
  labels: ReadonlyMap<number, string>,
): StatLine[] {
  const lines: StatLine[] = [];
  for (const row of rows) {
    const value = typeof row.value === "number" ? row.value : Number(row.value);
    if (!Number.isFinite(value) || value === 0) continue;
    const label = labels.get(row.statId)?.trim();
    if (!label) continue;
    lines.push({ label, value: Math.round(value * 100) / 100 });
  }
  return lines;
}

export function parseWeekStats(value: unknown): Array<{ statId: number; value: string | null }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object" || !("statId" in row)) return [];
    const statId = row.statId;
    const raw = "value" in row ? row.value : null;
    if (typeof statId !== "number") return [];
    return [{ statId, value: raw == null ? null : String(raw) }];
  });
}
