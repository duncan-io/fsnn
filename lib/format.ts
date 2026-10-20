import type { Team } from "@/lib/types";

export function formatRecord(team: Team): string {
  const { wins, losses, ties } = team.record;
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

export function formatPoints(value: number): string {
  return value.toFixed(1);
}

export function lookupTeams(ids: string[], teams: Team[]): Team[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  return ids.flatMap((id) => {
    const team = byId.get(id);
    return team ? [team] : [];
  });
}

const absoluteTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

/** Timezone-stable timestamp so server and client markup match. */
export function formatAbsoluteTime(iso: string): string {
  return absoluteTime.format(new Date(iso));
}
