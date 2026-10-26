import { NextResponse } from "next/server";
import { adminReturnUrl } from "@/lib/admin/status";
import { adminPassword, isAdminSession, sameSecret, takeOAuthState } from "@/lib/admin/session";
import { exchangeYahooToken, redirectUri, saveYahooToken } from "@/src/yahoo/client";

function back(params: Record<string, string>) {
  // Yahoo returns to YAHOO_REDIRECT_URI. Use that origin so the browser lands on
  // the public host instead of the process bind address.
  return NextResponse.redirect(adminReturnUrl(redirectUri(), params));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const expected = await takeOAuthState();

  if (!adminPassword() || !(await isAdminSession())) {
    return back({ error: "session" });
  }
  if (failure || !code || !sameSecret(expected, state)) {
    const detail = failure
      ? `Yahoo authorization failed: ${failure}`
      : "Invalid Yahoo authorization response.";
    return back({ error: "yahoo", detail: detail.slice(0, 240) });
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
    return back({ error: "yahoo", detail: detail.slice(0, 240) });
  }

  return back({ notice: "connected" });
}
