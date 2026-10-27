import { isBenchSlot } from "../facts/lineup";
import { FAAB_MIN } from "../opinion/angles";

export type BreakingKind = "trade" | "add" | "injury";

export type BreakingPlayer = {
  name: string | null;
  type: string | null;
  sourceTeamKey: string | null;
  destinationTeamKey: string | null;
  playerKey: string | null;
};

export type BreakingTransaction = {
  transactionKey: string;
  type: string | null;
  status: string | null;
  timestamp: Date | null;
  faabBid: number | null;
  players: BreakingPlayer[];
};

export type BreakingClub = {
  teamKey: string;
  teamName: string;
  wins: number | null;
  losses: number | null;
  ties: number | null;
  rank: number | null;
};

export type BreakingStarter = {
  playerKey: string;
  name: string;
  teamKey: string;
  selectedPosition: string | null;
  status: string | null;
  injuryNote: string | null;
  seasonPoints: number | null;
};

export type BreakingCandidate = {
  sourceKey: string;
  kind: BreakingKind;
  heat: number;
  teamKeys: string[];
  eventAt: Date | null;
  lines: string[];
};

const HOT_STATUS = new Set(["D", "O", "IR", "PUP"]);
const WATCH_STATUS = new Set(["Q"]);

export function briefText(candidate: BreakingCandidate): string {
  return candidate.lines.join("\n");
}

export function scoreBreaking(input: {
  transactions: BreakingTransaction[];
  starters: BreakingStarter[];
  clubs: BreakingClub[];
  seasonPoints: ReadonlyMap<string, number>;
}): BreakingCandidate[] {
  const clubs = new Map(input.clubs.map((club) => [club.teamKey, club]));
  const trades = input.transactions.flatMap((transaction) => tradeCandidate(transaction, clubs, input.seasonPoints));
  const adds = input.transactions.flatMap((transaction) => addCandidate(transaction, clubs, input.seasonPoints));
  const injuries = injuryCandidates(input.starters, clubs);
  return [...trades, ...adds, ...injuries];
}

export function pickBreaking(
  candidates: BreakingCandidate[],
  seen: ReadonlySet<string>,
): BreakingCandidate | null {
  const ranked = [...candidates].sort(
    (a, b) => b.heat - a.heat || a.sourceKey.localeCompare(b.sourceKey),
  );
  return ranked.find((candidate) => !seen.has(candidate.sourceKey)) ?? null;
}

export type BreakingDecision =
  | { action: "baseline"; candidates: BreakingCandidate[] }
  | { action: "quiet" }
  | { action: "capped" }
  | { action: "publish"; candidate: BreakingCandidate };

export function decideBreaking(input: {
  initialized: boolean;
  candidates: BreakingCandidate[];
  seen: ReadonlySet<string>;
  publishedLastDay: number;
}): BreakingDecision {
  if (!input.initialized) return { action: "baseline", candidates: input.candidates };
  const next = pickBreaking(input.candidates, input.seen);
  if (!next) return { action: "quiet" };
  if (input.publishedLastDay >= 2) return { action: "capped" };
  return { action: "publish", candidate: next };
}

function tradeCandidate(
  transaction: BreakingTransaction,
  clubs: Map<string, BreakingClub>,
  seasonPoints: ReadonlyMap<string, number>,
): BreakingCandidate[] {
  if (transaction.status !== "successful" || transaction.type !== "trade") return [];
  const added = namedAdds(transaction);
  if (added.length === 0) return [];
  const lines = added.flatMap((player) => moveLines(player, clubs, seasonPoints, "traded for", "sent"));
  const teamKeys = teamKeysOf(added);
  for (const key of teamKeys) {
    const line = clubLine(clubs.get(key));
    if (line) lines.push(line);
  }
  return [
    {
      sourceKey: `trade:${transaction.transactionKey}`,
      kind: "trade",
      heat: 60 + added.length * 5,
      teamKeys,
      eventAt: transaction.timestamp,
      lines,
    },
  ];
}

function addCandidate(
  transaction: BreakingTransaction,
  clubs: Map<string, BreakingClub>,
  seasonPoints: ReadonlyMap<string, number>,
): BreakingCandidate[] {
  if (transaction.status !== "successful" || transaction.type === "trade") return [];
  const bid = transaction.faabBid;
  if (bid == null || bid < FAAB_MIN) return [];
  const added = namedAdds(transaction);
  if (added.length === 0) return [];
  const lines = added.flatMap((player) => {
    const destination = player.destinationTeamKey ? clubs.get(player.destinationTeamKey) : undefined;
    const club = destination?.teamName ?? "A club";
    const points = seasonLine(player, seasonPoints);
    return [`${club} added ${player.name} for ${bid}.`, ...(points ? [points] : [])];
  });
  const teamKeys = teamKeysOf(added);
  for (const key of teamKeys) {
    const line = clubLine(clubs.get(key));
    if (line) lines.push(line);
  }
  return [
    {
      sourceKey: `add:${transaction.transactionKey}`,
      kind: "add",
      heat: bid,
      teamKeys,
      eventAt: transaction.timestamp,
      lines,
    },
  ];
}

function injuryCandidates(starters: BreakingStarter[], clubs: Map<string, BreakingClub>): BreakingCandidate[] {
  const byKey = new Map<string, BreakingCandidate>();
  for (const player of starters) {
    if (!player.name.trim()) continue;
    if (!player.selectedPosition || isBenchSlot(player.selectedPosition)) continue;
    const status = (player.status ?? "").trim().toUpperCase();
    const note = (player.injuryNote ?? "").trim().replace(/\s+/g, " ");
    const hot = HOT_STATUS.has(status);
    const watch = WATCH_STATUS.has(status);
    if (!hot && !watch && !note) continue;
    const club = clubs.get(player.teamKey);
    const lines = [
      `${player.name} is ${statusLabel(status, note)}.`,
      ...(note ? [`Injury: ${note}.`] : []),
      `${player.name} is a starter for ${club?.teamName ?? "a club"}.`,
    ];
    if (player.seasonPoints != null) lines.push(`${player.name} has ${formatPoints(player.seasonPoints)} season points.`);
    const clubFact = clubLine(club);
    if (clubFact) lines.push(clubFact);
    const candidate: BreakingCandidate = {
      sourceKey: `injury:${player.playerKey}:${status}:${note}`,
      kind: "injury",
      heat: hot ? 36 : 24,
      teamKeys: [player.teamKey],
      eventAt: null,
      lines,
    };
    const existing = byKey.get(candidate.sourceKey);
    if (!existing || candidate.heat > existing.heat) byKey.set(candidate.sourceKey, candidate);
  }
  return [...byKey.values()];
}

function namedAdds(transaction: BreakingTransaction): Array<BreakingPlayer & { name: string }> {
  return transaction.players.flatMap((player) => {
    const name = player.name?.trim() ?? "";
    if (player.type !== "add" || !name) return [];
    return [{ ...player, name }];
  });
}

function moveLines(
  player: BreakingPlayer & { name: string },
  clubs: Map<string, BreakingClub>,
  seasonPoints: ReadonlyMap<string, number>,
  acquired: string,
  sent: string,
): string[] {
  const destination = player.destinationTeamKey ? clubs.get(player.destinationTeamKey) : undefined;
  const source = player.sourceTeamKey ? clubs.get(player.sourceTeamKey) : undefined;
  const points = seasonLine(player, seasonPoints);
  return [
    `${destination?.teamName ?? "A club"} ${acquired} ${player.name}.`,
    ...(source ? [`${source.teamName} ${sent} ${player.name}.`] : []),
    ...(points ? [points] : []),
  ];
}

function seasonLine(player: { name: string; playerKey: string | null }, seasonPoints: ReadonlyMap<string, number>): string | null {
  if (!player.playerKey) return null;
  const points = seasonPoints.get(player.playerKey);
  if (points == null) return null;
  return `${player.name} has ${formatPoints(points)} season points.`;
}

function teamKeysOf(players: BreakingPlayer[]): string[] {
  const keys = new Set<string>();
  for (const player of players) {
    if (player.destinationTeamKey) keys.add(player.destinationTeamKey);
    if (player.sourceTeamKey) keys.add(player.sourceTeamKey);
  }
  return [...keys].sort();
}

function clubLine(club: BreakingClub | undefined): string | null {
  if (!club || club.wins == null || club.losses == null) return null;
  const ties = club.ties ?? 0;
  const record = ties > 0 ? `${club.wins}-${club.losses}-${ties}` : `${club.wins}-${club.losses}`;
  const rank = club.rank != null ? ` and ranked ${club.rank}` : "";
  return `${club.teamName} is ${record}${rank}.`;
}

function statusLabel(status: string, note: string): string {
  if (status === "O") return "out";
  if (status === "D") return "doubtful";
  if (status === "Q") return "questionable";
  if (status === "IR") return "on injured reserve";
  if (status === "PUP") return "on the physically unable to perform list";
  return note ? "hurt" : "questionable";
}

function formatPoints(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}
