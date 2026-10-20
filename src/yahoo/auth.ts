import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { exchangeYahooToken, redirectUri, saveYahooToken } from "./client";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local (see .env.example).`);
  return value;
}

function sameString(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function openBrowser(url: string) {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(command, args, { stdio: "ignore", detached: true }).unref();
}

export async function authorizeYahoo() {
  const clientId = requireEnv("YAHOO_CLIENT_ID");
  const callback = new URL(redirectUri());
  const state = randomBytes(16).toString("hex");
  const port = Number(callback.port || (callback.protocol === "https:" ? 443 : 80));

  console.log(`Yahoo must allow this redirect URI: ${callback.toString()}`);

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer();
    const deadline = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for Yahoo authorization."));
    }, 5 * 60 * 1000);

    server.on("request", (request, response) => {
      const url = new URL(request.url ?? "/", callback.origin);
      if (url.pathname !== callback.pathname) {
        response.writeHead(404, { "content-type": "text/plain" });
        response.end("Not found");
        return;
      }

      const failure = url.searchParams.get("error");
      const authCode = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state") ?? "";
      if (failure || !authCode || !sameString(returnedState, state)) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end(failure ? `Yahoo authorization failed: ${failure}` : "Invalid Yahoo authorization response.");
        clearTimeout(deadline);
        server.close();
        reject(new Error(failure ?? "Invalid Yahoo authorization response."));
        return;
      }

      response.writeHead(200, { "content-type": "text/plain" });
      response.end("Yahoo Fantasy is connected. You can close this tab.");
      clearTimeout(deadline);
      server.close();
      resolve(authCode);
    });

    server.on("error", (error) => {
      clearTimeout(deadline);
      if (error && typeof error === "object" && "code" in error && error.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use. Connect from /admin instead while the dev server is running.`,
          ),
        );
        return;
      }
      reject(error);
    });

    server.listen(port, callback.hostname, () => {
      const auth = new URL("https://api.login.yahoo.com/oauth2/request_auth");
      auth.searchParams.set("client_id", clientId);
      auth.searchParams.set("redirect_uri", callback.toString());
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("scope", "fspt-r");
      auth.searchParams.set("state", state);
      console.log("Opening Yahoo authorization. If the browser does not open, visit:");
      console.log(auth.toString());
      openBrowser(auth.toString());
    });
  });

  const token = await exchangeYahooToken({
    grant_type: "authorization_code",
    redirect_uri: callback.toString(),
    code,
  });
  await saveYahooToken(token);
  console.log("Saved the Yahoo refresh token.");
}
