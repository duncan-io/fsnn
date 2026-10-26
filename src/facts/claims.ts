export type ResultFact = {
  result: "win" | "tie";
  winnerName: string;
  loserName: string;
};

export type RankFact = {
  name: string;
  before: number;
  after: number;
};

export type PlayerPoints = {
  name: string;
  weekPoints: number | null;
};

const ORDINARY = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "nor",
  "but",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "from",
  "with",
  "after",
  "before",
  "over",
  "under",
  "into",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "not",
  "no",
  "week",
  "weeks",
  "final",
  "finals",
  "recap",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "night",
  "nfl",
  "faab",
  "vs",
  "yahoo",
  "power",
  "rankings",
  "rank",
  "roster",
  "starter",
  "starters",
  "schedule",
  "projection",
  "all",
  "play",
  "waiver",
  "trade",
  "traded",
  "added",
  "points",
  "qb",
  "rb",
  "wr",
  "te",
  "dst",
  "ir",
]);

export function ordinaryWords(): Set<string> {
  return ORDINARY;
}

export function collectNumbers(value: unknown, into: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) into.push(value, Math.abs(value));
  else if (typeof value === "string") {
    for (const match of value.matchAll(/\d+(?:\.\d+)?/g)) into.push(Number(match[0]));
  } else if (Array.isArray(value)) value.forEach((item) => collectNumbers(item, into));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectNumbers(item, into));
  return into;
}

export function collectNameTokens(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    for (const word of value.split(/[^A-Za-z0-9'’]+/)) {
      const token = normalizeToken(word);
      if (token) into.add(token);
    }
  } else if (Array.isArray(value)) value.forEach((item) => collectNameTokens(item, into));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectNameTokens(item, into));
  return into;
}

export function numbersIn(text: string): number[] {
  return [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

export function capitalizedWords(text: string): string[] {
  return text.match(/[A-Z][A-Za-z0-9'’.-]*/g) ?? [];
}

export function normalizeToken(word: string): string {
  return word.toLowerCase().replace(/['’]s$/, "").replace(/[^a-z0-9]/g, "");
}

export function numberErrors(copy: string, allowed: number[]): string[] {
  const errors: string[] = [];
  for (const value of numbersIn(copy)) {
    if (!allowed.some((candidate) => Math.abs(candidate - value) < 0.001)) errors.push(`Invented number ${value}.`);
  }
  return errors;
}

export function nameErrors(copy: string, names: Set<string>, ordinary: Set<string>): string[] {
  const errors: string[] = [];
  for (const word of capitalizedWords(copy)) {
    const token = normalizeToken(word);
    if (!names.has(token) && !ordinary.has(token)) errors.push(`Unknown name ${word}.`);
  }
  return errors;
}

export function resultErrors(copy: string, matchups: ResultFact[]): string[] {
  const errors: string[] = [];
  for (const sentence of sentences(copy)) {
    if (/\b(faab|waiver|bid)\b/i.test(sentence)) continue;
    for (const matchup of matchups) {
      const winner = escapeRegExp(matchup.winnerName);
      const loser = escapeRegExp(matchup.loserName);
      const hasWinner = includesName(sentence, matchup.winnerName);
      const hasLoser = includesName(sentence, matchup.loserName);
      if (matchup.result === "win") {
        const loserBeatWinner = new RegExp(
          `\\b${loser}\\b[\\s\\S]{0,40}\\b(beat|beats|defeated)\\s+${winner}\\b`,
          "i",
        );
        const loserWon = new RegExp(`\\b${loser}\\b[\\s\\S]{0,40}\\bwon\\b`, "i");
        const beatWinner = new RegExp(`\\b(beat|beats|defeated)\\s+${winner}\\b`, "i");
        if (loserBeatWinner.test(sentence) || (loserWon.test(sentence) && hasWinner)) {
          errors.push(`${matchup.loserName} did not win.`);
        }
        if (beatWinner.test(sentence) && hasLoser) errors.push(`${matchup.winnerName} was not beaten.`);
        if (hasWinner && hasLoser && /\b(tie|tied|ties)\b/i.test(sentence)) {
          errors.push(`${matchup.winnerName} and ${matchup.loserName} did not tie.`);
        }
      } else if (
        (hasWinner || hasLoser) &&
        (new RegExp(`\\b(beat|beats|defeated)\\s+(${winner}|${loser})\\b`, "i").test(sentence) ||
          (hasWinner && hasLoser && new RegExp(`\\b(${winner}|${loser})\\b[\\s\\S]{0,40}\\bwon\\b`, "i").test(sentence)))
      ) {
        errors.push(`${matchup.winnerName} and ${matchup.loserName} tied.`);
      }
    }
  }
  return errors;
}

export function rankErrors(copy: string, teams: RankFact[]): string[] {
  const errors: string[] = [];
  for (const sentence of sentences(copy)) {
    if (!/\brank\b/i.test(sentence)) continue;
    for (const team of teams) {
      if (!includesName(sentence, team.name)) continue;
      const change = team.before - team.after;
      const climbed = /\b(climb|climbs|climbed|rose)\b/i.test(sentence);
      const fell = /\b(fell|dropped)\b/i.test(sentence);
      const held = /\bheld\b/i.test(sentence);
      if (change > 0 && fell) errors.push(`${team.name} climbed from rank ${team.before} to rank ${team.after}.`);
      if (change < 0 && climbed) errors.push(`${team.name} fell from rank ${team.before} to rank ${team.after}.`);
      if (change === 0 && (climbed || fell)) errors.push(`${team.name} held rank ${team.after}.`);
      if (change !== 0 && held) errors.push(`${team.name} moved from rank ${team.before} to rank ${team.after}.`);
    }
  }
  return errors;
}

export function pointTotalErrors(copy: string, players: PlayerPoints[]): string[] {
  const errors: string[] = [];
  const known = players.filter((player) => player.name && player.weekPoints != null);
  for (const sentence of sentences(copy)) {
    for (const player of known) {
      const index = sentence.toLowerCase().indexOf(player.name.toLowerCase());
      if (index < 0) continue;
      const window = sentence.slice(index, index + player.name.length + 80);
      const match = window.match(/(\d+(?:\.\d+)?)\s+points\b/i);
      if (!match) continue;
      const value = Number(match[1]);
      if (Math.abs(value - (player.weekPoints ?? 0)) >= 0.001) {
        errors.push(`${player.name} scored ${player.weekPoints} points.`);
      }
    }
  }
  return errors;
}

function sentences(copy: string): string[] {
  return copy
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function includesName(sentence: string, name: string): boolean {
  return sentence.toLowerCase().includes(name.toLowerCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
