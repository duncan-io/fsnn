export function rankingsSlug(leagueKey: string, week: number): string {
  return `week-${week}-${slugPart(leagueKey)}-power-rankings`;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
