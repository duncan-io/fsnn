import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { yahooResources, yahooTokens } from "../db/schema";
import { flattenYahoo, isRecord, normalizeYahooPath, str } from "./parse";

const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const API_ROOT = "https://fantasysports.yahooapis.com/fantasy/v2";
const TOKEN_ID = "default";

export class YahooApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "YahooApiError";
  }
}

export type YahooToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
};

export type YahooResponse = {
  path: string;
  status: number;
  body: unknown;
  flat: unknown;
};

type TokenRequest = {
  grant_type: "authorization_code" | "refresh_token";
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local (see .env.example).`);
  }
  return value;
}

export function redirectUri() {
  return process.env.YAHOO_REDIRECT_URI || "http://127.0.0.1:8787/callback";
}

function basicAuth() {
  const clientId = requireEnv("YAHOO_CLIENT_ID");
  const clientSecret = requireEnv("YAHOO_CLIENT_SECRET");
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function tokenError(body: unknown, status: number) {
  if (isRecord(body)) {
    const description = str(body.error_description) ?? str(body.error);
    if (description) return `Yahoo token request failed (${status}): ${description}`;
  }
  return `Yahoo token request failed (${status}).`;
}

export async function exchangeYahooToken(request: TokenRequest): Promise<YahooToken> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(request)) {
    if (value) body.set(key, value);
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isToken(payload)) {
    throw new Error(tokenError(payload, response.status));
  }
  return payload;
}

function isToken(value: unknown): value is YahooToken {
  if (!isRecord(value) || typeof value.access_token !== "string" || typeof value.refresh_token !== "string") {
    return false;
  }
  const expiresIn = Number(value.expires_in);
  if (!Number.isFinite(expiresIn)) return false;
  value.expires_in = expiresIn;
  return true;
}

export async function saveYahooToken(token: YahooToken) {
  const db = getDb();
  try {
    await db
      .insert(yahooTokens)
      .values({
        id: TOKEN_ID,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        tokenType: token.token_type ?? "bearer",
        scope: token.scope ?? "fspt-r",
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: yahooTokens.id,
        set: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: new Date(Date.now() + token.expires_in * 1000),
          tokenType: token.token_type ?? "bearer",
          scope: token.scope ?? "fspt-r",
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(
      "Yahoo rotated the refresh token and it could not be saved. Store this value before retrying:",
    );
    console.error(token.refresh_token);
    throw error;
  }
}

function apiError(body: unknown, status: number) {
  if (isRecord(body) && isRecord(body.error)) {
    const description = str(body.error.description);
    const detail = str(body.error.detail);
    const message = [description, detail].filter(Boolean).join(": ");
    if (message) return message;
  }
  return `Yahoo request failed (${status}).`;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class YahooClient {
  private refreshTask: Promise<void> | null = null;

  async get(pathInput: string): Promise<YahooResponse> {
    const path = normalizeYahooPath(pathInput);
    let refreshed = false;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accessToken = await this.accessToken();
      const url = new URL(`${API_ROOT}/${path}`);
      url.searchParams.set("format", "json");
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (response.status === 401 && !refreshed) {
        refreshed = true;
        await response.body?.cancel();
        await this.forceRefresh();
        continue;
      }
      if ((response.status === 429 || response.status === 503 || response.status === 999) && attempt < 4) {
        await response.body?.cancel();
        await sleep(1000 * 2 ** attempt);
        continue;
      }

      const body = await readBody(response);
      await getDb().insert(yahooResources).values({
        path,
        status: response.status,
        body,
      });
      if (!response.ok) throw new YahooApiError(apiError(body, response.status), response.status, body);
      return { path, status: response.status, body, flat: flattenYahoo(body) };
    }

    throw new Error(`Yahoo request failed after retries: ${path}`);
  }

  private async accessToken() {
    const row = await this.tokenRow();
    if (row.expiresAt.getTime() > Date.now() + 60_000) return row.accessToken;
    await this.forceRefresh();
    return (await this.tokenRow()).accessToken;
  }

  private async forceRefresh() {
    if (!this.refreshTask) {
      this.refreshTask = this.refreshOnce().finally(() => {
        this.refreshTask = null;
      });
    }
    await this.refreshTask;
  }

  private async refreshOnce() {
    const row = await this.tokenRow();
    try {
      const token = await exchangeYahooToken({
        grant_type: "refresh_token",
        refresh_token: row.refreshToken,
      });
      await saveYahooToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Yahoo token refresh failed.";
      throw new Error(`${message} Run bun run yahoo:auth if the refresh token is no longer valid.`);
    }
  }

  private async tokenRow() {
    const [row] = await getDb().select().from(yahooTokens).where(eq(yahooTokens.id, TOKEN_ID)).limit(1);
    if (!row) throw new Error("No Yahoo token is stored. Run bun run yahoo:auth.");
    return row;
  }
}
