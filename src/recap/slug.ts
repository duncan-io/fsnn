export function recapSlug(leagueKey: string, week: number, matchupKey: string | null): string {
  const league = slugPart(leagueKey);
  if (!matchupKey) return `week-${week}-${league}-recap`;
  return `week-${week}-${slugPart(matchupKey)}`;
}

export function matchupAnchor(matchupKey: string): string {
  return `matchup-${slugPart(matchupKey)}`;
}

function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
