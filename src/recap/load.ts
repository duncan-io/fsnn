import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { leagues, matchups } from "../db/schema";
import { getActiveLeagueKey } from "../leagues/active";
import { assembleDossier, loadLeagueWeek, toBriefInput } from "../facts/dossier";
import { enrichBrief } from "../facts/sheet";
import { buildWeekBrief, completedWeek } from "./brief";
import type { WeekBrief } from "./types";

export async function listRecapLeagues() {
  const key = await getActiveLeagueKey();
  if (!key) return [];
  const db = getDb();
  return db
    .select({ leagueKey: leagues.leagueKey, name: leagues.name, gameKey: leagues.gameKey })
    .from(leagues)
    .where(eq(leagues.leagueKey, key));
}

export async function latestCompletedWeek(leagueKey: string): Promise<number | null> {
  const db = getDb();
  const rows = await db
    .select({ week: matchups.week, status: matchups.status })
    .from(matchups)
    .where(eq(matchups.leagueKey, leagueKey));
  return completedWeek(rows);
}

export async function loadWeekBrief(leagueKey: string, week: number): Promise<WeekBrief | null> {
  const source = await loadLeagueWeek(leagueKey, week);
  if (!source) return null;
  if (completedWeek(source.matchups, week) == null) return null;
  const brief = enrichBrief(buildWeekBrief(toBriefInput(source)), assembleDossier(source));
  return brief.matchups.length > 0 ? brief : null;
}
