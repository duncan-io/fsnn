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
