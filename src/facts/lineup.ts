const BENCH = new Set(["BN", "IR", "IR-R", "RES", "NA", "TAXI"]);

export function isBenchSlot(slot: string | null | undefined): boolean {
  return slot != null && BENCH.has(slot.toUpperCase());
}

export function benchPoints(players: Array<{ role: "starter" | "bench"; weekPoints: number | null }>): number | null {
  const scored = players.filter((player) => player.role === "bench" && player.weekPoints != null);
  if (scored.length === 0) return null;
  return round(scored.reduce((sum, player) => sum + (player.weekPoints ?? 0), 0));
}

export function starterPoints(players: Array<{ role: "starter" | "bench"; weekPoints: number | null }>): number | null {
  const scored = players.filter((player) => player.role === "starter" && player.weekPoints != null);
  if (scored.length === 0) return null;
  return round(scored.reduce((sum, player) => sum + (player.weekPoints ?? 0), 0));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
