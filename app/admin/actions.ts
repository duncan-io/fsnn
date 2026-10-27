"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { publicError, YAHOO_TOKEN_ID } from "@/lib/admin/status";
import { generateWeek, summarizeBackfill } from "@/src/backfill/week";
import {
  adminPassword,
  clearAdminSession,
  isAdminSession,
  passwordsMatch,
  setAdminSession,
  setOAuthState,
} from "@/lib/admin/session";
import { getDb } from "@/src/db/client";
import { yahooTokens } from "@/src/db/schema";
import { redirectUri } from "@/src/yahoo/client";
import { discardHeldArticle, publishHeldArticle } from "@/src/desk/queue";
import { discardOpinion, publishOpinion, resolveLeague } from "@/src/opinion/store";
import type { OpinionDesk } from "@/src/opinion/types";
import { describeBreaking, writeBreaking } from "@/src/breaking/write";
import { describeWrite, writeOpinion } from "@/src/opinion/write";
import { syncCurrentNfl } from "@/src/yahoo/sync";

async function guard() {
  if (!adminPassword()) redirect("/admin?error=locked");
  if (!(await isAdminSession())) redirect("/admin?error=session");
}

export async function login(formData: FormData) {
  const password = adminPassword();
  if (!password) redirect("/admin?error=locked");
  const input = String(formData.get("password") ?? "");
  if (!passwordsMatch(input, password)) redirect("/admin?error=password");
  await setAdminSession();
  redirect("/admin");
}

export async function logout() {
  await clearAdminSession();
  redirect("/admin");
}

export async function connectYahoo() {
  await guard();
  const clientId = process.env.YAHOO_CLIENT_ID;
  if (!clientId || !process.env.YAHOO_CLIENT_SECRET) {
    redirect("/admin?error=connect&detail=Yahoo+client+credentials+are+missing.");
  }
  const state = await setOAuthState();
  const auth = new URL("https://api.login.yahoo.com/oauth2/request_auth");
  auth.searchParams.set("client_id", clientId);
  auth.searchParams.set("redirect_uri", redirectUri());
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "fspt-r");
  auth.searchParams.set("state", state);
  redirect(auth.toString());
}

export async function disconnectYahoo() {
  await guard();
  await getDb().delete(yahooTokens).where(eq(yahooTokens.id, YAHOO_TOKEN_ID));
  redirect("/admin?notice=disconnected");
}

export async function syncYahoo() {
  await guard();
  let failed = false;
  let detail = "";
  try {
    const summary = await syncCurrentNfl();
    detail = summary.message;
  } catch (error) {
    failed = true;
    detail = error instanceof Error ? error.message : "Sync failed.";
  }
  const query = new URLSearchParams({ detail: detail.slice(0, 240) });
  query.set(failed ? "error" : "notice", "sync");
  redirect(`/admin?${query.toString()}`);
}

export async function generateBackfillWeek(formData: FormData) {
  await guard();
  const week = Number(formData.get("week"));
  let failed = false;
  let detail = "";
  try {
    if (!Number.isInteger(week) || week < 1) throw new Error("Pick a week.");
    const league = await resolveLeague();
    const results = await generateWeek(league.leagueKey, week);
    failed = results.some((result) => !result.ok);
    detail = summarizeBackfill(week, results);
  } catch (error) {
    failed = true;
    detail = publicError(error);
  }
  const query = new URLSearchParams({ detail: detail.slice(0, 240) });
  query.set(failed ? "error" : "notice", "backfill");
  redirect(`/admin?${query.toString()}`);
}

export async function writeBreakingStory() {
  await guard();
  let failed = false;
  let detail = "";
  try {
    detail = describeBreaking(await writeBreaking());
  } catch (error) {
    failed = true;
    detail = publicError(error);
  }
  const query = new URLSearchParams({ detail: detail.slice(0, 240) });
  query.set(failed ? "error" : "notice", "breaking");
  redirect(`/admin?${query.toString()}`);
}

export async function writeResultsColumn() {
  await writeDesk("results");
}

export async function writeWaiverColumn() {
  await writeDesk("waivers");
}

async function writeDesk(desk: OpinionDesk) {
  await guard();
  let failed = false;
  let detail = "";
  try {
    detail = describeWrite(desk, await writeOpinion(desk));
  } catch (error) {
    failed = true;
    detail = publicError(error);
  }
  const query = new URLSearchParams({ detail: detail.slice(0, 240) });
  query.set(failed ? "error" : "notice", "column");
  redirect(`/admin?${query.toString()}`);
}

export async function publishColumn(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  let detail = "";
  try {
    if (!id) throw new Error("Missing column.");
    await publishOpinion(id);
  } catch (error) {
    detail = publicError(error);
  }
  if (detail) {
    const query = new URLSearchParams({ detail: detail.slice(0, 240) });
    query.set("error", "column");
    redirect(`/admin?${query.toString()}`);
  }
  redirect("/admin?notice=published");
}

export async function discardColumn(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  let detail = "";
  try {
    if (!id) throw new Error("Missing column.");
    await discardOpinion(id);
  } catch (error) {
    detail = publicError(error);
  }
  if (detail) {
    const query = new URLSearchParams({ detail: detail.slice(0, 240) });
    query.set("error", "column");
    redirect(`/admin?${query.toString()}`);
  }
  redirect("/admin?notice=discarded");
}

export async function publishHeld(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  let detail = "";
  try {
    if (!id) throw new Error("Missing piece.");
    await publishHeldArticle(id);
  } catch (error) {
    detail = publicError(error);
  }
  if (detail) {
    const query = new URLSearchParams({ detail: detail.slice(0, 240) });
    query.set("error", "held");
    redirect(`/admin?${query.toString()}`);
  }
  redirect("/admin?notice=held&detail=Piece+published.");
}

export async function discardHeld(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  let detail = "";
  try {
    if (!id) throw new Error("Missing piece.");
    await discardHeldArticle(id);
  } catch (error) {
    detail = publicError(error);
  }
  if (detail) {
    const query = new URLSearchParams({ detail: detail.slice(0, 240) });
    query.set("error", "held");
    redirect(`/admin?${query.toString()}`);
  }
  redirect("/admin?notice=held&detail=Piece+discarded.");
}
