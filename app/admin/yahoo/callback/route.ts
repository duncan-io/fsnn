import { NextResponse } from "next/server";
import { adminPassword, isAdminSession, sameSecret, takeOAuthState } from "@/lib/admin/session";
import { exchangeYahooToken, redirectUri, saveYahooToken } from "@/src/yahoo/client";

function back(request: Request, params: Record<string, string>) {
  const url = new URL("/admin", request.url);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const expected = await takeOAuthState();

  if (!adminPassword() || !(await isAdminSession())) {
    return back(request, { error: "session" });
  }
  if (failure || !code || !sameSecret(expected, state)) {
    const detail = failure
      ? `Yahoo authorization failed: ${failure}`
      : "Invalid Yahoo authorization response.";
    return back(request, { error: "yahoo", detail: detail.slice(0, 240) });
  }

  try {
    const token = await exchangeYahooToken({
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
      code,
    });
    await saveYahooToken(token);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Yahoo token exchange failed.";
    return back(request, { error: "yahoo", detail: detail.slice(0, 240) });
  }

  return back(request, { notice: "connected" });
}
