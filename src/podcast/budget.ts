import type { PlayerPoints, RankFact, ResultFact } from "../facts/claims";
import type { TeamFacts } from "../facts/types";
import type { LookupPlayer } from "../search/lookup";
import type { BriefMatchup, BriefSide, WeekBrief } from "../recap/types";
import { EMPTY_DESK, type DeskContext } from "./desk";
import type { PreviewBrief, PreviewMatchup } from "./preview";
import { SHOW } from "./show";
import type { PlannedSegment, SegmentKind } from "./types";

const TARGET = 2000;

const WEIGHT: Record<SegmentKind, number> = {
  open: 100,
  recap: 180,
  wire: 150,
  preview: 130,
  close: 70,
};

export function planSegments(recap: WeekBrief, preview: PreviewBrief | null, desk: DeskContext = EMPTY_DESK): PlannedSegment[] {
  const previewWeek = preview?.week ?? null;
  const teams = new Map((preview?.teams ?? []).map((team) => [team.teamKey, team]));
  const segments: PlannedSegment[] = [openSegment(recap, previewWeek, desk)];
  for (const matchup of recap.matchups) segments.push(recapSegment(recap, matchup, desk));
  if (recap.transactions.length > 0) segments.push(wireSegment(recap, previewWeek, desk));
  for (const matchup of preview?.matchups ?? []) segments.push(previewSegment(recap, previewWeek, matchup, teams, desk));
  segments.push(closeSegment(recap, previewWeek, desk));
  const budgets = assignBudgets(segments.map((segment) => segment.kind));
  return segments.map((segment, index) => ({ ...segment, budget: budgets[index] ?? 0 }));
}

function assignBudgets(kinds: SegmentKind[]): number[] {
  const weights = kinds.map((kind) => WEIGHT[kind]);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const budgets = weights.map((weight) => Math.round((weight / sum) * TARGET));
  const drift = TARGET - budgets.reduce((total, budget) => total + budget, 0);
  const last = budgets.length - 1;
  if (last >= 0) budgets[last] = (budgets[last] ?? 0) + drift;
  return budgets;
}

function openSegment(brief: WeekBrief, previewWeek: number | null, desk: DeskContext): PlannedSegment {
  return base("open", null, attach(leagueFacts(brief, previewWeek), desk.lastShow), brief);
}

function closeSegment(brief: WeekBrief, previewWeek: number | null, desk: DeskContext): PlannedSegment {
  return base("close", null, attach(leagueFacts(brief, previewWeek), desk.lastShow), brief);
}

function wireSegment(brief: WeekBrief, previewWeek: number | null, desk: DeskContext): PlannedSegment {
  const column = desk.columns.find((card) => card.desk === "waivers") ?? null;
  return base("wire", null, attach({ ...leagueFacts(brief, previewWeek), transactions: brief.transactions }, column), brief);
}

function recapSegment(brief: WeekBrief, matchup: BriefMatchup, desk: DeskContext): PlannedSegment {
  const facts = attach(
    {
      show: SHOW.title,
      leagueName: brief.leagueName,
      recapWeek: brief.week,
      matchup,
    },
    desk.recaps.find((card) => card.matchupKey === matchup.matchupKey) ?? null,
  );
  return {
    id: `recap:${matchup.matchupKey}`,
    kind: "recap",
    matchupKey: matchup.matchupKey,
    budget: 0,
    facts,
    players: [...playersFromSide(matchup.winner), ...playersFromSide(matchup.loser)],
    results: [
      {
        result: matchup.result,
        winnerName: matchup.winner.teamName,
        loserName: matchup.loser.teamName,
      },
    ],
    ranks: [rankOf(matchup.winner), rankOf(matchup.loser)],
    playerPoints: [...pointsFromSide(matchup.winner), ...pointsFromSide(matchup.loser)],
    previewTeams: null,
  };
}

function previewSegment(
  brief: WeekBrief,
  previewWeek: number | null,
  matchup: PreviewMatchup,
  teams: Map<string, TeamFacts>,
  desk: DeskContext,
): PlannedSegment {
  const home = teams.get(matchup.home.teamKey) ?? null;
  const away = teams.get(matchup.away.teamKey) ?? null;
  return {
    id: `preview:${matchup.matchupKey}`,
    kind: "preview",
    matchupKey: matchup.matchupKey,
    budget: 0,
    facts: attach(
      {
        show: SHOW.title,
        leagueName: brief.leagueName,
        recapWeek: brief.week,
        previewWeek,
        matchupKey: matchup.matchupKey,
        home: { teamName: matchup.home.teamName, projectedPoints: matchup.home.projectedPoints, team: home },
        away: { teamName: matchup.away.teamName, projectedPoints: matchup.away.projectedPoints, team: away },
      },
      previewDesk(matchup.home.teamKey, matchup.away.teamKey, desk),
    ),
    players: [...playersFromTeam(home), ...playersFromTeam(away)],
    results: [...resultFromTeam(home), ...resultFromTeam(away)],
    ranks: [...rankFromTeam(home), ...rankFromTeam(away)],
    playerPoints: [...pointsFromTeam(home), ...pointsFromTeam(away)],
    previewTeams: [matchup.home.teamName, matchup.away.teamName],
  };
}

function base(kind: "open" | "wire" | "close", matchupKey: string | null, facts: unknown, brief: WeekBrief): PlannedSegment {
  return {
    id: kind,
    kind,
    matchupKey,
    budget: 0,
    facts,
    players: brief.matchups.flatMap((matchup) => [...playersFromSide(matchup.winner), ...playersFromSide(matchup.loser)]),
    results: brief.matchups.map((matchup) => ({
      result: matchup.result,
      winnerName: matchup.winner.teamName,
      loserName: matchup.loser.teamName,
    })),
    ranks: brief.matchups.flatMap((matchup) => [rankOf(matchup.winner), rankOf(matchup.loser)]),
    playerPoints: brief.matchups.flatMap((matchup) => [...pointsFromSide(matchup.winner), ...pointsFromSide(matchup.loser)]),
    previewTeams: null,
  };
}

function attach<T extends object>(facts: T, card: unknown): T & { desk?: unknown } {
  if (card == null) return facts;
  return { ...facts, desk: card };
}

function previewDesk(homeKey: string, awayKey: string, desk: DeskContext) {
  const rankings = desk.rankings.filter((line) => line.teamKey === homeKey || line.teamKey === awayKey);
  const column = desk.columns.find((card) => card.teamKeys.includes(homeKey) || card.teamKeys.includes(awayKey)) ?? null;
  if (rankings.length === 0 && !column) return null;
  return { rankings, column };
}

function leagueFacts(brief: WeekBrief, previewWeek: number | null) {
  const standings = new Map<string, { teamName: string; wins: number; losses: number; ties: number; rankBefore: number; rankAfter: number }>();
  for (const matchup of brief.matchups) {
    for (const side of [matchup.winner, matchup.loser]) {
      standings.set(side.teamKey, {
        teamName: side.teamName,
        wins: side.record.wins,
        losses: side.record.losses,
        ties: side.record.ties,
        rankBefore: side.rankBefore,
        rankAfter: side.rankAfter,
      });
    }
  }
  return {
    show: SHOW.title,
    leagueName: brief.leagueName,
    recapWeek: brief.week,
    previewWeek,
    standings: [...standings.values()].sort((a, b) => a.rankAfter - b.rankAfter || a.teamName.localeCompare(b.teamName)),
    results: brief.matchups.map((matchup) => ({
      result: matchup.result,
      winner: matchup.winner.teamName,
      winnerPoints: matchup.winner.points,
      loser: matchup.loser.teamName,
      loserPoints: matchup.loser.points,
      margin: matchup.margin,
    })),
  };
}

function rankOf(side: BriefSide): RankFact {
  return { name: side.teamName, before: side.rankBefore, after: side.rankAfter };
}

function playersFromSide(side: BriefSide): LookupPlayer[] {
  return (side.lineup ?? []).map((player) => ({
    name: player.name,
    nflTeam: player.nflTeam,
    weekPoints: player.weekPoints,
  }));
}

function pointsFromSide(side: BriefSide): PlayerPoints[] {
  return [
    ...(side.lineup ?? []).map((player) => ({ name: player.name, weekPoints: player.weekPoints })),
    ...side.topPerformers.map((player) => ({ name: player.name, weekPoints: player.points })),
  ];
}

function playersFromTeam(team: TeamFacts | null): LookupPlayer[] {
  return (team?.lineup ?? []).map((player) => ({
    name: player.name,
    nflTeam: player.nflTeam,
    weekPoints: player.weekPoints,
  }));
}

function pointsFromTeam(team: TeamFacts | null): PlayerPoints[] {
  return (team?.lineup ?? []).map((player) => ({ name: player.name, weekPoints: player.weekPoints }));
}

function resultFromTeam(team: TeamFacts | null): ResultFact[] {
  const week = team?.weekResult;
  if (!team || !week) return [];
  if (week.result === "tie") return [{ result: "tie", winnerName: team.teamName, loserName: week.opponentName }];
  if (week.result === "loss") return [{ result: "win", winnerName: week.opponentName, loserName: team.teamName }];
  return [{ result: "win", winnerName: team.teamName, loserName: week.opponentName }];
}

function rankFromTeam(team: TeamFacts | null): RankFact[] {
  if (!team) return [];
  const last = team.rankByWeek.at(-1);
  const previous = team.rankByWeek.at(-2) ?? last;
  if (!last || !previous) return [];
  return [{ name: team.teamName, before: previous.rank, after: last.rank }];
}
