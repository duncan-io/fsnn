import type { Angle, TeamSeason, WaiverAdd, WeekLine } from "./types";

/** Angles below this are too thin to spend a column on. */
export const HEAT_FLOOR = 12;

const RANK_GAP_MIN = 2;
const POINT_GAP_MIN = 12;
const FAAB_MIN = 12;
const MOVES_MIN = 4;

export function scoreResults(standings: TeamSeason[], lines: WeekLine[]): Angle[] {
  return [...recordAngles(standings), ...projectionAngles(standings, lines)];
}

export function scoreWaivers(standings: TeamSeason[], adds: WaiverAdd[]): Angle[] {
  return [...faabAngles(adds), ...churnAngles(standings)];
}

export function pickAngle(angles: Angle[], used: ReadonlySet<string>): Angle | null {
  const ranked = [...angles].sort(
    (a, b) =>
      b.heat - a.heat ||
      a.angleId.localeCompare(b.angleId) ||
      (a.teamKeys[0] ?? "").localeCompare(b.teamKeys[0] ?? ""),
  );
  for (const angle of ranked) {
    if (angle.heat < HEAT_FLOOR) continue;
    const blocked = angle.teamKeys.some((key) => used.has(`${angle.angleId}:${key}`));
    if (blocked) continue;
    return angle;
  }
  return null;
}

export function usedAngleKey(angleId: string, teamKey: string) {
  return `${angleId}:${teamKey}`;
}

function recordAngles(standings: TeamSeason[]): Angle[] {
  const ranks = pointsForRanks(standings);
  const angles: Angle[] = [];
  for (const team of standings) {
    const scoringRank = ranks.get(team.teamKey);
    if (scoringRank == null) continue;
    const gap = Math.abs(team.rank - scoringRank);
    if (gap < RANK_GAP_MIN) continue;
    const ahead = team.rank < scoringRank;
    const record = formatRecord(team);
    const points = formatStat(team.pointsFor);
    const against = formatStat(team.pointsAgainst);
    angles.push({
      angleId: ahead ? "record-ahead" : "record-behind",
      claim: ahead
        ? `${team.teamName}'s ${record} record is ahead of the points.`
        : `${team.teamName}'s ${record} record is behind the points.`,
      evidence: [
        `${team.teamName} is ${record} and ranked ${team.rank} in the standings.`,
        `${team.teamName} has scored ${points} points, ${ordinal(scoringRank)} in scoring.`,
        `The gap between standing rank and scoring rank is ${gap}.`,
      ],
      counterEvidence: ahead
        ? [
            `${team.teamName} has still won ${team.wins} games, and a win counts the same as a blowout.`,
            `Opponents have scored ${against} points against ${team.teamName}.`,
          ]
        : [
            `The losses count: opponents have scored ${against} points against ${team.teamName}.`,
            `${team.teamName} is still ${ordinal(team.rank)} in the standings at ${record}.`,
          ],
      heat: gap * 8,
      teamKeys: [team.teamKey],
    });
  }
  return angles;
}

function projectionAngles(standings: TeamSeason[], lines: WeekLine[]): Angle[] {
  const seasons = new Map(standings.map((team) => [team.teamKey, team]));
  const ranks = pointsForRanks(standings);
  const angles: Angle[] = [];
  for (const line of lines) {
    const gap = round1(line.points - line.projectedPoints);
    const size = Math.abs(gap);
    if (size < POINT_GAP_MIN) continue;
    const boom = gap > 0;
    const season = seasons.get(line.teamKey);
    const scoringRank = ranks.get(line.teamKey);
    const points = formatStat(line.points);
    const projected = formatStat(line.projectedPoints);
    const opponentPoints = formatStat(line.opponentPoints);
    const margin = formatStat(size);
    const result =
      line.points > line.opponentPoints
        ? `beat ${line.opponentName} ${points} to ${opponentPoints}`
        : line.points < line.opponentPoints
          ? `lost to ${line.opponentName} ${opponentPoints} to ${points}`
          : `tied ${line.opponentName} ${points} to ${opponentPoints}`;
    const seasonLine = season
      ? `${line.teamName} has scored ${formatStat(season.pointsFor)} points on the season${
          scoringRank ? `, ${ordinal(scoringRank)} in scoring` : ""
        }.`
      : `${line.teamName} scored ${formatStat(line.seasonPointsFor)} points on the season.`;
    angles.push({
      angleId: boom ? "weekly-boom" : "weekly-bust",
      claim: boom
        ? `${line.teamName} was a ${margin}-point boom in week ${line.week}, scoring ${points} against a ${projected} projection.`
        : `${line.teamName} was a ${margin}-point bust in week ${line.week}, scoring ${points} against a ${projected} projection.`,
      evidence: [
        `${line.teamName} scored ${points} points in week ${line.week}. The projection was ${projected}.`,
        `${line.teamName} ${result}.`,
        `That is ${margin} points ${boom ? "over" : "under"} the projection.`,
      ],
      counterEvidence: [
        `The projection was ${projected}, so this week is a spike against the number, not the whole season.`,
        seasonLine,
      ],
      heat: Math.round(size),
      teamKeys: [line.teamKey],
    });
  }
  return angles;
}

function faabAngles(adds: WaiverAdd[]): Angle[] {
  return adds
    .filter((add) => add.bid >= FAAB_MIN)
    .map((add) => {
      const record = formatRecord(add);
      const production =
        add.seasonPoints == null
          ? `${add.playerName} does not have season points in the sync yet.`
          : `${add.playerName} has scored ${formatStat(add.seasonPoints)} points this season.`;
      return {
        angleId: "faab-add",
        claim: `${add.teamName} spent ${add.bid} FAAB on ${add.playerName}, the kind of bid that has to show up.`,
        evidence: [
          `${add.teamName} bid ${add.bid} FAAB on ${add.playerName}.`,
          `${add.teamName} is ${record} and ranked ${add.rank}.`,
          `${add.teamName} has scored ${formatStat(add.pointsFor)} points this season.`,
          production,
        ],
        counterEvidence: [
          production,
          `${add.teamName} is ${record}, ranked ${add.rank}, so the roster around that add is already on the board.`,
        ],
        heat: add.bid,
        teamKeys: [add.teamKey],
      };
    });
}

function churnAngles(standings: TeamSeason[]): Angle[] {
  if (standings.length === 0) return [];
  const most = Math.max(...standings.map((team) => team.moves));
  if (most < MOVES_MIN) return [];
  const half = Math.floor(standings.length / 2);
  return standings
    .filter((team) => team.moves === most)
    .map((team) => {
      const bottom = team.rank > half;
      const record = formatRecord(team);
      return {
        angleId: bottom ? "churn-bottom" : "churn-top",
        claim: bottom
          ? `${team.teamName} has made ${team.moves} roster moves and still sits ${ordinal(team.rank)} at ${record}.`
          : `${team.teamName} is ${ordinal(team.rank)} and has made ${team.moves} roster moves, the most in the league.`,
        evidence: [
          `${team.teamName} has made ${team.moves} roster moves.`,
          `${team.teamName} is ${record} and ranked ${team.rank} of ${standings.length}.`,
          `${team.teamName} has scored ${formatStat(team.pointsFor)} points.`,
        ],
        counterEvidence: bottom
          ? [
              `${team.teamName} has still scored ${formatStat(team.pointsFor)} points, ${ordinal(team.rank)} place aside.`,
              `The record is ${record}, so the moves have a season attached to them.`,
            ]
          : [
              `${team.teamName} is ${record}, so the moves are attached to a standing that is already working.`,
              `${team.teamName} has scored ${formatStat(team.pointsFor)} points.`,
            ],
        heat: team.moves * (bottom ? 5 : 3),
        teamKeys: [team.teamKey],
      };
    });
}

function pointsForRanks(standings: TeamSeason[]): Map<string, number> {
  const sorted = [...standings].sort(
    (a, b) => b.pointsFor - a.pointsFor || a.teamKey.localeCompare(b.teamKey),
  );
  const ranks = new Map<string, number>();
  let lastPoints: number | null = null;
  let lastRank = 0;
  sorted.forEach((team, index) => {
    if (lastPoints === null || team.pointsFor !== lastPoints) {
      lastRank = index + 1;
      lastPoints = team.pointsFor;
    }
    ranks.set(team.teamKey, lastRank);
  });
  return ranks;
}

function formatRecord(team: { wins: number; losses: number; ties: number }) {
  return team.ties > 0 ? `${team.wins}-${team.losses}-${team.ties}` : `${team.wins}-${team.losses}`;
}

function formatStat(value: number) {
  return round1(value).toFixed(1);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
