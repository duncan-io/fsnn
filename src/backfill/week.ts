import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { gameWeeks, leagues } from "../db/schema";
import { illustrateRecap, illustrateStored } from "../images/illustrate";
import { resolveLeague } from "../opinion/store";
import type { OpinionDesk } from "../opinion/types";
import { writeOpinion } from "../opinion/write";
import { assignPersona } from "../personas/staff";
import { loadRankingsBrief } from "../rankings/load";
import { saveRankings } from "../rankings/publish";
import { rankingsSlug } from "../rankings/slug";
import { writeRankings } from "../rankings/write";
import { loadWeekBrief } from "../recap/load";
import { saveRecap } from "../recap/publish";
import { writeRecap } from "../recap/write";
import { slotFor } from "./schedule";

export type PieceName = "recap" | "rankings" | "results" | "waivers";

export type PieceResult = {
  piece: PieceName;
  ok: boolean;
  detail: string;
};

export async function generateWeek(leagueKey: string, week: number): Promise<PieceResult[]> {
  return [
    await runPiece("recap", async () => {
      const piece = await generateRecap(leagueKey, week);
      if (!piece) throw new Error(`Week ${week} is not final.`);
      return piece.outcome === "needs-edit" ? "needs edit" : "ok";
    }),
    await runPiece("rankings", async () => {
      const piece = await generateRankings(leagueKey, week);
      if (!piece) throw new Error(`Week ${week} is not final.`);
      return piece.outcome === "needs-edit" ? "needs edit" : "ok";
    }),
    await runPiece("results", () => generateOpinion(leagueKey, week, "results")),
    await runPiece("waivers", () => generateOpinion(leagueKey, week, "waivers")),
  ];
}

export function summarizeBackfill(week: number, results: PieceResult[]): string {
  const parts = results.map((result) =>
    result.ok ? `${result.piece} ${result.detail}` : `${result.piece} failed: ${result.detail}`,
  );
  return `Week ${week}: ${parts.join(", ")}`;
}

export type GeneratedPiece = {
  outcome: "published" | "needs-edit";
  message: string;
};

export async function generateRecap(leagueKey: string, week: number): Promise<GeneratedPiece | null> {
  const brief = await loadWeekBrief(leagueKey, week);
  if (!brief) return null;
  if (!brief.weekEnd) throw new Error(`Week ${week} has no end date.`);
  const persona = assignPersona("weekly-recap", `${brief.leagueKey}:${brief.week}:weekly-recap`);
  const written = await writeRecap(brief, persona);
  if (!written.ok) {
    await saveRecap(brief, written.draft, persona, {
      status: "needs-edit",
      publishedAt: null,
      reviewNotes: written.notes,
    });
    return { outcome: "needs-edit", message: `Week ${week} recap needs edit for ${brief.leagueName}.` };
  }
  await saveRecap(brief, written.draft, persona, {
    status: "published",
    publishedAt: slotFor(brief.weekEnd, "recap"),
    reviewNotes: null,
  });
  await illustrateRecap(brief, written.draft);
  return { outcome: "published", message: `Published week ${week} for ${brief.leagueName}.` };
}

export async function generateRankings(leagueKey: string, week: number): Promise<GeneratedPiece | null> {
  const brief = await loadRankingsBrief(leagueKey, week);
  if (!brief) return null;
  const persona = assignPersona("power-rankings", `${brief.leagueKey}:${brief.week}:power-rankings`);
  const written = await writeRankings(brief, persona);
  if (!written.ok) {
    await saveRankings(brief, written.draft, persona, {
      status: "needs-edit",
      publishedAt: null,
      reviewNotes: written.notes,
    });
    return { outcome: "needs-edit", message: `Week ${week} power rankings need edit for ${brief.leagueName}.` };
  }
  await saveRankings(brief, written.draft, persona, {
    status: "published",
    publishedAt: slotFor(await weekEndFor(leagueKey, week), "rankings"),
    reviewNotes: null,
  });
  await illustrateStored({
    kind: "article",
    slug: rankingsSlug(brief.leagueKey, brief.week),
    headline: written.draft.headline,
    dek: written.draft.dek,
  });
  return { outcome: "published", message: `Published week ${week} power rankings for ${brief.leagueName}.` };
}

async function generateOpinion(leagueKey: string, week: number, desk: OpinionDesk): Promise<string> {
  const league = await resolveLeague();
  if (league.leagueKey !== leagueKey) throw new Error("Set LEAGUE_KEY to this league before writing columns.");
  const result = await writeOpinion(desk, { week, backfill: true });
  if (result.outcome === "no-angle") return "no angle";
  if (result.outcome === "needs-edit") return "needs edit";
  return "ok";
}

async function runPiece(piece: PieceName, work: () => Promise<string>): Promise<PieceResult> {
  try {
    return { piece, ok: true, detail: await work() };
  } catch (error) {
    const detail = (error instanceof Error ? error.message : "Failed.").replace(/[\r\n]+/g, " ").trim().slice(0, 180);
    return { piece, ok: false, detail: detail || "Failed." };
  }
}

async function weekEndFor(leagueKey: string, week: number): Promise<string> {
  const db = getDb();
  const [league] = await db
    .select({ gameKey: leagues.gameKey })
    .from(leagues)
    .where(eq(leagues.leagueKey, leagueKey))
    .limit(1);
  if (!league) throw new Error("League not found.");
  const [row] = await db
    .select({ endDate: gameWeeks.endDate })
    .from(gameWeeks)
    .where(and(eq(gameWeeks.gameKey, league.gameKey), eq(gameWeeks.week, week)))
    .limit(1);
  if (!row?.endDate) throw new Error(`Week ${week} has no end date.`);
  return row.endDate;
}
