import type { TeamFacts } from "../facts/types";
import { assembleDossier, loadLeagueWeek } from "../facts/dossier";
import type { BriefMatchupRow } from "../recap/types";

export type PreviewSide = {
  teamKey: string;
  teamName: string;
  projectedPoints: number | null;
};

export type PreviewMatchup = {
  matchupKey: string;
  home: PreviewSide;
  away: PreviewSide;
};

export type PreviewBrief = {
  leagueKey: string;
  leagueName: string;
  week: number;
  matchups: PreviewMatchup[];
  teams: TeamFacts[];
};

export function buildPreviewMatchups(
  rows: BriefMatchupRow[],
  week: number,
  names: ReadonlyMap<string, string>,
): PreviewMatchup[] {
  const groups = new Map<string, BriefMatchupRow[]>();
  for (const row of rows) {
    if (row.week !== week || !row.opponentTeamKey) continue;
    const matchupKey = [row.teamKey, row.opponentTeamKey].sort().join(":");
    const group = groups.get(matchupKey) ?? [];
    group.push(row);
    groups.set(matchupKey, group);
  }
  const matchups = [...groups.entries()].flatMap(([matchupKey, group]) => {
    const home = group[0];
    const away = home ? group.find((row) => row.teamKey === home.opponentTeamKey) : undefined;
    if (!home || !away) return [];
    return [
      {
        matchupKey,
        home: side(home, names),
        away: side(away, names),
      },
    ];
  });
  matchups.sort((a, b) => a.matchupKey.localeCompare(b.matchupKey));
  return matchups;
}

export async function loadPreviewBrief(leagueKey: string, recapWeek: number): Promise<PreviewBrief | null> {
  const source = await loadLeagueWeek(leagueKey, recapWeek);
  if (!source) return null;
  const dossier = assembleDossier(source);
  const names = new Map(dossier.teams.map((team) => [team.teamKey, team.teamName]));
  const matchups = buildPreviewMatchups(source.matchups, recapWeek + 1, names);
  if (matchups.length === 0) return null;
  return {
    leagueKey: source.leagueKey,
    leagueName: source.leagueName,
    week: recapWeek + 1,
    matchups,
    teams: dossier.teams,
  };
}

function side(row: BriefMatchupRow, names: ReadonlyMap<string, string>): PreviewSide {
  return {
    teamKey: row.teamKey,
    teamName: names.get(row.teamKey) ?? row.teamKey,
    projectedPoints: numberOrNull(row.projectedPoints),
  };
}

function numberOrNull(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}
