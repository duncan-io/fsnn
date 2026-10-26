import type { BriefMatchup, BriefSide, WeekBrief } from "../recap/types";
import type { TeamFacts, WeekDossier } from "./types";
import { matchupLeads } from "./leads";

export function enrichBrief(brief: WeekBrief, dossier: WeekDossier): WeekBrief {
  const teams = new Map(dossier.teams.map((team) => [team.teamKey, team]));
  return {
    ...brief,
    scoringType: dossier.league.scoringType,
    rosterSlots: dossier.league.rosterSlots,
    matchups: brief.matchups.map((matchup) => {
      const next: BriefMatchup = {
        ...matchup,
        winner: attachSide(matchup.winner, teams.get(matchup.winner.teamKey)),
        loser: attachSide(matchup.loser, teams.get(matchup.loser.teamKey)),
      };
      return { ...next, leads: matchupLeads(next, brief.transactions) };
    }),
  };
}

export function teamFactLines(team: TeamFacts): string[] {
  const lines = [
    `${team.teamName} manager ${team.managerName ?? "unknown"}.`,
  ];
  if (team.faabBalance != null) lines.push(`${team.teamName} has ${team.faabBalance} FAAB left.`);
  if (team.waiverPriority != null) lines.push(`${team.teamName} waiver priority is ${team.waiverPriority}.`);
  if (team.moves != null) lines.push(`${team.teamName} has made ${team.moves} roster moves.`);
  if (team.trades != null) lines.push(`${team.teamName} has made ${team.trades} trades.`);
  if (team.benchPoints != null) lines.push(`${team.teamName} left ${team.benchPoints} on the bench.`);
  if (team.weekStarterPoints != null) lines.push(`${team.teamName} starters scored ${team.weekStarterPoints} this week.`);
  if (team.longestStreak) lines.push(`${team.teamName} longest streak is ${team.longestStreak}.`);
  if (team.biggestWin) {
    lines.push(
      `${team.teamName} biggest win is ${team.biggestWin.margin} over ${team.biggestWin.opponentName} in week ${team.biggestWin.week}.`,
    );
  }
  for (const series of team.headToHead) {
    lines.push(
      `${team.teamName} is ${series.wins}-${series.losses}-${series.ties} against ${series.opponentName}.`,
    );
  }
  for (const opponent of team.remainingOpponents) {
    const rate = opponent.pointsPerGame == null ? "an unknown rate" : `${opponent.pointsPerGame} a game`;
    lines.push(`${team.teamName} still plays ${opponent.name}, who scores ${rate}.`);
  }
  if (team.playoff) {
    const weeks = team.playoff.weeksLeft == null ? "unknown weeks" : `${team.playoff.weeksLeft} weeks`;
    lines.push(
      `${team.teamName} is ${team.playoff.gamesBack} games back with ${team.playoff.teamsAhead} teams ahead and ${weeks} left.`,
    );
  }
  if (team.weekResult) {
    lines.push(
      `${team.teamName} week result ${team.weekResult.result} against ${team.weekResult.opponentName}, ${team.weekResult.points} to ${team.weekResult.opponentPoints}.`,
    );
  }
  for (const spot of team.rankByWeek) {
    lines.push(`${team.teamName} rank after week ${spot.week} was ${spot.rank}.`);
  }
  for (const player of team.lineup) {
    const stats = player.weekStats.map((stat) => `${stat.value} ${stat.label}`).join(", ");
    const injury = player.injuryNote ? ` Injury: ${player.injuryNote}.` : "";
    const draft =
      player.draftRound != null && player.draftPick != null
        ? ` Drafted round ${player.draftRound}, pick ${player.draftPick}.`
        : "";
    const owned = player.percentOwned == null ? "" : ` Owned ${player.percentOwned} percent.`;
    const season = player.seasonPoints == null ? "" : ` Season points ${player.seasonPoints}.`;
    const points = player.weekPoints == null ? "no week points" : `${player.weekPoints} points`;
    lines.push(
      `${player.name}, ${player.nflTeam ?? "NFL"}, ${player.position ?? "FLEX"}, ${player.role} ${player.slot ?? ""}, ${points}.${stats ? ` Stats: ${stats}.` : ""}${injury}${draft}${owned}${season}`,
    );
  }
  return lines;
}

function attachSide(side: BriefSide, team: TeamFacts | undefined): BriefSide {
  if (!team) return side;
  return {
    ...side,
    lineup: team.lineup,
    benchPoints: team.benchPoints,
    faabBalance: team.faabBalance,
    waiverPriority: team.waiverPriority,
    moves: team.moves,
    trades: team.trades,
    longestStreak: team.longestStreak,
    biggestWin: team.biggestWin,
    headToHead: team.headToHead,
    remainingOpponents: team.remainingOpponents,
    playoff: team.playoff,
    rankByWeek: team.rankByWeek,
  };
}
