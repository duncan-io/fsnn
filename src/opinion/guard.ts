import {
  collectNameTokens,
  collectNumbers,
  nameErrors,
  numberErrors,
  ordinaryWords,
  pointTotalErrors,
  rankErrors,
  resultErrors,
  type PlayerPoints,
  type RankFact,
  type ResultFact,
} from "../facts/claims";

const NUMBER = /\d+(?:\.\d+)?/g;

export type BriefCopy = {
  leagueName: string;
  week: number;
  claim: string;
  evidence: string[];
  counterEvidence: string[];
};

export function briefText(source: BriefCopy): string {
  return [
    `League: ${source.leagueName}`,
    `Week: ${source.week}`,
    `Claim: ${source.claim}`,
    "Evidence:",
    ...source.evidence.map((line) => `- ${line}`),
    "Counter-evidence:",
    ...source.counterEvidence.map((line) => `- ${line}`),
  ].join("\n");
}

export function unexpectedNumbers(prose: string, brief: string): string[] {
  const allowed = numbersIn(brief).map(Number);
  const bad: string[] = [];
  for (const token of numbersIn(prose)) {
    const value = Number(token);
    if (!allowed.some((item) => item === value)) bad.push(token);
  }
  return [...new Set(bad)];
}

function numbersIn(text: string): string[] {
  return text.match(NUMBER) ?? [];
}

export function reviewOpinion(
  prose: string,
  corpus: string,
  notes: string[],
  facts: { results: ResultFact[]; ranks: RankFact[]; players: PlayerPoints[] },
): string[] {
  const allowed = collectNumbers(corpus);
  const names = collectNameTokens(corpus);
  for (const note of notes) {
    collectNumbers(note, allowed);
    collectNameTokens(note, names);
  }
  return [
    ...numberErrors(prose, allowed),
    ...nameErrors(prose, names, ordinaryWords()),
    ...resultErrors(prose, facts.results),
    ...rankErrors(prose, facts.ranks),
    ...pointTotalErrors(prose, facts.players),
  ];
}
