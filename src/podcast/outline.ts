import { minimaxJsonDraft, type DraftTool } from "../minimax/draft";
import { auditOutline } from "./audit";
import type { PlannedSegment, PodcastOutline } from "./types";
import { outlineStyle } from "./voice";

const ATTEMPTS = 3;
const DRAFT_TOKENS = 3000;

export async function writeOutline(plan: PlannedSegment[], week: number, tools: DraftTool[] = []): Promise<PodcastOutline> {
  const errors: string[] = [];
  let last = "Outline failed the audit.";
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    let outline: PodcastOutline;
    try {
      outline = await requestOutline(plan, week, errors, tools);
    } catch (error) {
      last = error instanceof Error ? error.message : "Outline could not be read.";
      errors.splice(0, errors.length, last);
      continue;
    }
    const audited = auditOutline(plan, outline);
    if (audited.ok) return outline;
    last = audited.errors.join("\n");
    errors.splice(0, errors.length, ...audited.errors);
  }
  throw new Error(last);
}

async function requestOutline(plan: PlannedSegment[], week: number, errors: string[], tools: DraftTool[]): Promise<PodcastOutline> {
  const correction = errors.length > 0 ? `\n\nFix these problems and return the full JSON again:\n${errors.join("\n")}` : "";
  const sheet = plan.map((segment) => ({
    id: segment.id,
    kind: segment.kind,
    budget: segment.budget,
    facts: segment.facts,
  }));
  const result = await minimaxJsonDraft({
    system: outlineStyle(),
    user: `${JSON.stringify({ sections: sheet })}${correction}`,
    players: plan.flatMap((segment) => segment.players),
    week,
    maxTokens: DRAFT_TOKENS,
    temperature: 0.8,
    tools,
    parse: (value) => readOutline(value),
  });
  return result.value;
}

export function readOutline(value: unknown): PodcastOutline {
  if (!value || typeof value !== "object") throw new Error("Outline JSON was empty.");
  const row = value as { title?: unknown; description?: unknown; sections?: unknown };
  if (typeof row.title !== "string" || typeof row.description !== "string" || !Array.isArray(row.sections)) {
    throw new Error("Outline JSON is missing a title, description, or sections.");
  }
  const title = row.title.trim();
  const description = row.description.trim();
  if (!title || !description) throw new Error("Outline JSON was empty.");
  const sections = row.sections.map(readSection);
  if (sections.length === 0) throw new Error("Outline JSON has no sections.");
  return { title, description, sections };
}

function readSection(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Outline section was empty.");
  const row = value as {
    id?: unknown;
    angle?: unknown;
    jerry?: unknown;
    greg?: unknown;
    facts?: unknown;
    handoff?: unknown;
  };
  if (typeof row.id !== "string" || typeof row.angle !== "string" || typeof row.jerry !== "string" || typeof row.greg !== "string") {
    throw new Error("Outline section is missing an id or a stance.");
  }
  if (!Array.isArray(row.facts) || typeof row.handoff !== "string") {
    throw new Error("Outline section is missing facts or a handoff.");
  }
  const facts = row.facts.filter((fact): fact is string => typeof fact === "string" && fact.trim().length > 0).map((fact) => fact.trim());
  return {
    id: row.id.trim(),
    angle: row.angle.trim(),
    jerry: row.jerry.trim(),
    greg: row.greg.trim(),
    facts,
    handoff: row.handoff.trim(),
  };
}
