import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { appSettings, leagues } from "../db/schema";

export const ACTIVE_LEAGUE_SETTING = "active_league_key";

export type SyncedLeague = {
  leagueKey: string;
  name: string | null;
  numTeams: number | null;
  currentWeek: number | null;
};

export type ActiveLeaguePick =
  | { ok: true; leagueKey: string }
  | { ok: false; message: string };

export type ActiveLeagueStatus = {
  leagues: SyncedLeague[];
  selectedKey: string | null;
  lockedByEnv: boolean;
  message: string | null;
};

export function envLeagueKey(env: NodeJS.ProcessEnv = process.env) {
  const key = env.LEAGUE_KEY?.trim();
  return key || undefined;
}

export function leagueLabel(league: { name: string | null; leagueKey: string }) {
  return league.name?.trim() || league.leagueKey;
}

export function pickActiveLeague(input: {
  envKey?: string;
  storedKey?: string | null;
  leagueKeys: readonly string[];
}): ActiveLeaguePick {
  const envKey = input.envKey?.trim() || undefined;
  const storedKey = input.storedKey?.trim() || undefined;
  const known = new Set(input.leagueKeys);

  if (envKey) {
    if (!known.has(envKey)) {
      return { ok: false, message: `No league stored for ${envKey}. Sync Yahoo first.` };
    }
    return { ok: true, leagueKey: envKey };
  }

  if (storedKey && known.has(storedKey)) return { ok: true, leagueKey: storedKey };

  if (input.leagueKeys.length === 0) {
    return { ok: false, message: "No leagues stored. Sync Yahoo first." };
  }
  if (input.leagueKeys.length === 1) {
    const only = input.leagueKeys[0];
    if (only) return { ok: true, leagueKey: only };
  }
  return { ok: false, message: "Pick an active league in Admin." };
}

export async function listSyncedLeagues(): Promise<SyncedLeague[]> {
  const rows = await getDb()
    .select({
      leagueKey: leagues.leagueKey,
      name: leagues.name,
      numTeams: leagues.numTeams,
      currentWeek: leagues.currentWeek,
    })
    .from(leagues);
  return rows.sort((left, right) => leagueLabel(left).localeCompare(leagueLabel(right)));
}

async function storedLeagueKey() {
  const [row] = await getDb()
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, ACTIVE_LEAGUE_SETTING))
    .limit(1);
  return row?.value ?? null;
}

async function decideActiveLeague() {
  const synced = await listSyncedLeagues();
  const pick = pickActiveLeague({
    envKey: envLeagueKey(),
    storedKey: await storedLeagueKey(),
    leagueKeys: synced.map((league) => league.leagueKey),
  });
  return { synced, pick };
}

export async function getActiveLeagueKey(): Promise<string | null> {
  const { pick } = await decideActiveLeague();
  return pick.ok ? pick.leagueKey : null;
}

export async function loadActiveLeagueStatus(): Promise<ActiveLeagueStatus> {
  const synced = await listSyncedLeagues();
  const envKey = envLeagueKey();
  const pick = pickActiveLeague({
    envKey,
    storedKey: await storedLeagueKey(),
    leagueKeys: synced.map((league) => league.leagueKey),
  });
  let message: string | null = null;
  if (envKey && !pick.ok) message = `LEAGUE_KEY is set, but ${envKey} is not synced.`;
  else if (envKey) message = "LEAGUE_KEY overrides the Admin picker.";
  else if (synced.length === 0) message = "Sync Yahoo to load leagues.";
  else if (!pick.ok) message = "Choose which league this newsroom covers.";
  return {
    leagues: synced,
    selectedKey: pick.ok ? pick.leagueKey : null,
    lockedByEnv: Boolean(envKey),
    message,
  };
}

export async function setActiveLeagueKey(leagueKey: string) {
  const key = leagueKey.trim();
  if (!key) throw new Error("Choose a league.");
  const db = getDb();
  const [row] = await db
    .select({ leagueKey: leagues.leagueKey })
    .from(leagues)
    .where(eq(leagues.leagueKey, key))
    .limit(1);
  if (!row) throw new Error("That league is not synced. Sync Yahoo first.");
  await db
    .insert(appSettings)
    .values({ key: ACTIVE_LEAGUE_SETTING, value: key, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: key, updatedAt: new Date() },
    });
}

export async function persistSoleLeagueIfUnset() {
  if (envLeagueKey()) return;
  const synced = await listSyncedLeagues();
  if (synced.length !== 1) return;
  if (await storedLeagueKey()) return;
  const only = synced[0];
  if (!only) return;
  await setActiveLeagueKey(only.leagueKey);
}

export async function requireActiveLeague() {
  const { pick } = await decideActiveLeague();
  if (!pick.ok) throw new Error(pick.message);
  return pick.leagueKey;
}
