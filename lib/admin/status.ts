import { desc, eq } from "drizzle-orm";
import { io } from "next/cache";
import postgres from "postgres";
import { getDb } from "@/src/db/client";
import { yahooResources, yahooTokens } from "@/src/db/schema";
import { redirectUri } from "@/src/yahoo/client";

export const YAHOO_TOKEN_ID = "default";

export type DatabaseStatus = {
  ok: boolean;
  message: string;
};

export type YahooConnectionStatus = {
  connected: boolean;
  accessExpiresAt: string | null;
  accessCurrent: boolean;
  scope: string | null;
  updatedAt: string | null;
  lastFetchAt: string | null;
};

export type AdminSettings = {
  clientId: boolean;
  clientSecret: boolean;
  minimaxKey: boolean;
  redirectUri: string;
  redirectMatchesCallback: boolean;
  database: DatabaseStatus;
};

export type AdminDashboard = {
  settings: AdminSettings;
  connection: YahooConnectionStatus | null;
  connectionError: string | null;
};

export function callbackPathMatches(uri: string) {
  try {
    return new URL(uri).pathname === "/admin/yahoo/callback";
  } catch {
    return false;
  }
}

export function publicError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Something went wrong.";
  return raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[database]")
    .replace(/\/\/[^/\s@]+@/g, "//[credentials]@")
    .slice(0, 240);
}

async function databaseStatus(): Promise<DatabaseStatus> {
  const url = process.env.DATABASE_URL;
  if (!url) return { ok: false, message: "DATABASE_URL is missing." };
  const client = postgres(url, { max: 1, connect_timeout: 5 });
  try {
    await client`select 1`;
    return { ok: true, message: "Reachable" };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  } finally {
    await client.end({ timeout: 1 });
  }
}

async function yahooConnection(): Promise<YahooConnectionStatus> {
  const db = getDb();
  const [token] = await db
    .select({
      expiresAt: yahooTokens.expiresAt,
      scope: yahooTokens.scope,
      updatedAt: yahooTokens.updatedAt,
    })
    .from(yahooTokens)
    .where(eq(yahooTokens.id, YAHOO_TOKEN_ID))
    .limit(1);
  const [latest] = await db
    .select({ fetchedAt: yahooResources.fetchedAt })
    .from(yahooResources)
    .orderBy(desc(yahooResources.fetchedAt))
    .limit(1);

  if (!token) {
    return {
      connected: false,
      accessExpiresAt: null,
      accessCurrent: false,
      scope: null,
      updatedAt: null,
      lastFetchAt: latest?.fetchedAt.toISOString() ?? null,
    };
  }

  return {
    connected: true,
    accessExpiresAt: token.expiresAt.toISOString(),
    accessCurrent: token.expiresAt.getTime() > Date.now() + 60_000,
    scope: token.scope,
    updatedAt: token.updatedAt.toISOString(),
    lastFetchAt: latest?.fetchedAt.toISOString() ?? null,
  };
}

export async function loadAdminDashboard(): Promise<AdminDashboard> {
  await io();
  const uri = redirectUri();
  const settings: AdminSettings = {
    clientId: Boolean(process.env.YAHOO_CLIENT_ID),
    clientSecret: Boolean(process.env.YAHOO_CLIENT_SECRET),
    minimaxKey: Boolean(process.env.MINIMAX_API_KEY),
    redirectUri: uri,
    redirectMatchesCallback: callbackPathMatches(uri),
    database: await databaseStatus(),
  };

  if (!settings.database.ok) {
    return {
      settings,
      connection: null,
      connectionError: "Could not read Yahoo status because the database is unreachable.",
    };
  }

  try {
    return { settings, connection: await yahooConnection(), connectionError: null };
  } catch (error) {
    return { settings, connection: null, connectionError: publicError(error) };
  }
}
