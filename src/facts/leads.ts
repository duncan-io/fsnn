import type { BriefMatchup, BriefTransaction } from "../recap/types";

export function matchupLeads(matchup: BriefMatchup, transactions: BriefTransaction[]): string[] {
  const leads: Array<{ heat: number; text: string }> = [];
  const winnerBench = matchup.winner.benchPoints;
  const loserBench = matchup.loser.benchPoints;
  if (winnerBench != null && winnerBench > 0) {
    leads.push({ heat: winnerBench, text: `${matchup.winner.teamName} left ${winnerBench} on the bench.` });
  }
  if (loserBench != null && loserBench > 0) {
    leads.push({ heat: loserBench, text: `${matchup.loser.teamName} left ${loserBench} on the bench.` });
  }
  for (const side of [matchup.winner, matchup.loser]) {
    if (side.projectionDelta == null || side.projectionDelta === 0) continue;
    const direction = side.projectionDelta > 0 ? "over" : "under";
    leads.push({
      heat: Math.abs(side.projectionDelta),
      text: `${side.teamName} scored ${Math.abs(side.projectionDelta)} ${direction} a ${side.projectedPoints} projection.`,
    });
  }
  if (matchup.result === "tie") {
    leads.push({ heat: matchup.margin, text: `${matchup.winner.teamName} tied ${matchup.loser.teamName}.` });
  } else if (matchup.margin > 0) {
    leads.push({
      heat: matchup.margin,
      text: `${matchup.winner.teamName} won by ${matchup.margin}.`,
    });
  }
  for (const side of [matchup.winner, matchup.loser]) {
    const change = side.rankBefore - side.rankAfter;
    if (change === 0) continue;
    const verb = change > 0 ? "climbed" : "fell";
    leads.push({
      heat: Math.abs(change) * 10,
      text: `${side.teamName} ${verb} from rank ${side.rankBefore} to rank ${side.rankAfter}.`,
    });
  }
  const names = new Set([matchup.winner.teamName, matchup.loser.teamName]);
  for (const transaction of transactions) {
    const touched = transaction.players.some(
      (player) =>
        (player.destinationTeamName && names.has(player.destinationTeamName)) ||
        (player.sourceTeamName && names.has(player.sourceTeamName)),
    );
    if (!touched) continue;
    const player = transaction.players.find((item) => item.name);
    if (!player?.name) continue;
    const team = player.destinationTeamName && names.has(player.destinationTeamName) ? player.destinationTeamName : player.sourceTeamName;
    if (!team || !names.has(team)) continue;
    const bid = transaction.faabBid;
    const text =
      bid != null && bid > 0
        ? `${team} added ${player.name} for ${bid}.`
        : `${team} ${player.action === "add" ? "added" : "moved"} ${player.name}.`;
    leads.push({ heat: bid != null && bid > 0 ? bid : 8, text });
  }
  return leads
    .sort((a, b) => b.heat - a.heat || a.text.localeCompare(b.text))
    .slice(0, 3)
    .map((lead) => lead.text);
}
