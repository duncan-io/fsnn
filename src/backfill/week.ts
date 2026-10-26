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
      const message = await generateRecap(leagueKey, week);
      if (!message) throw new Error(`Week ${week} is not final.`);
      return "ok";
    }),
    await runPiece("rankings", async () => {
      const message = await generateRankings(leagueKey, week);
      if (!message) throw new Error(`Week ${week} is not final.`);
      return "ok";
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

export async function generateRecap(leagueKey: string, week: number): Promise<string | null> {
  const brief = await loadWeekBrief(leagueKey, week);
  if (!brief) return null;
  if (!brief.weekEnd) throw new Error(`Week ${week} has no end date.`);
  const persona = assignPersona("weekly-recap", `${brief.leagueKey}:${brief.week}:weekly-recap`);
  const draft = await writeRecap(brief, persona);
  await saveRecap(brief, draft, persona, slotFor(brief.weekEnd, "recap"));
  await illustrateRecap(brief, draft);
  return `Published week ${week} for ${brief.leagueName}.`;
}

export async function generateRankings(leagueKey: string, week: number): Promise<string | null> {
  const brief = await loadRankingsBrief(leagueKey, week);
  if (!brief) return null;
  const publishedAt = slotFor(await weekEndFor(leagueKey, week), "rankings");
  const persona = assignPersona("power-rankings", `${brief.leagueKey}:${brief.week}:power-rankings`);
  const draft = await writeRankings(brief, persona);
  await saveRankings(brief, draft, persona, publishedAt);
  await illustrateStored({
    kind: "article",
    slug: rankingsSlug(brief.leagueKey, brief.week),
    headline: draft.headline,
    dek: draft.dek,
  });
  return `Published week ${week} power rankings for ${brief.leagueName}.`;
}

async function generateOpinion(leagueKey: string, week: number, desk: OpinionDesk): Promise<string> {
  const league = await resolveLeague();
  if (league.leagueKey !== leagueKey) throw new Error("Set LEAGUE_KEY to this league before writing columns.");
  const result = await writeOpinion(desk, { week, backfill: true });
  if (result.outcome === "no-angle") return "no angle";
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
