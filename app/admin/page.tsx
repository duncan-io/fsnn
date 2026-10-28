import { Suspense } from "react";
import { PendingButton } from "@/components/admin/PendingButton";
import {
  connectYahoo,
  discardColumn,
  discardHeld,
  disconnectYahoo,
  generateBackfillWeek,
  login,
  logout,
  publishColumn,
  publishHeld,
  setActiveLeague,
  syncYahoo,
  writeBreakingStory,
  writeResultsColumn,
  writeWaiverColumn,
} from "@/app/admin/actions";
import { adminPassword, isAdminSession } from "@/lib/admin/session";
import {
  loadAdminDashboard,
  loadBackfillWeeks,
  publicError,
  type BackfillWeek,
  type YahooConnectionStatus,
} from "@/lib/admin/status";
import { listHeldArticles, type HeldArticle } from "@/src/desk/queue";
import { leagueLabel, loadActiveLeagueStatus, type ActiveLeagueStatus } from "@/src/leagues/active";
import { listReviewColumns, resolveLeague, type OpinionColumnView } from "@/src/opinion/store";
import { formatAbsoluteTime } from "@/lib/format";
import { pageWidth } from "@/lib/labels";

export const metadata = {
  title: "Admin",
};

export const maxDuration = 800;

type AdminSearch = {
  error?: string | string[];
  detail?: string | string[];
  notice?: string | string[];
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeDetail(value: string | undefined) {
  if (!value) return "";
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 240);
}

function flashMessage(params: AdminSearch) {
  const detail = safeDetail(one(params.detail));
  const error = one(params.error);
  const notice = one(params.notice);
  if (error === "password") return { ok: false, text: "That password is wrong." };
  if (error === "session") return { ok: false, text: "Sign in to continue." };
  if (error === "locked") return { ok: false, text: "Admin is locked until ADMIN_PASSWORD is set." };
  if (error === "yahoo") return { ok: false, text: detail || "Yahoo authorization failed." };
  if (error === "sync") return { ok: false, text: detail || "Sync failed." };
  if (error === "connect") return { ok: false, text: detail || "Could not start the Yahoo connection." };
  if (error === "column") return { ok: false, text: detail || "Could not write the column." };
  if (error === "held") return { ok: false, text: detail || "Could not update that piece." };
  if (error === "breaking") return { ok: false, text: detail || "Could not write the breaking story." };
  if (error === "backfill") return { ok: false, text: detail || "Could not generate that week." };
  if (error === "league") return { ok: false, text: detail || "Could not save the league." };
  if (notice === "column") return { ok: true, text: detail || "Column saved." };
  if (notice === "breaking") return { ok: true, text: detail || "Breaking story filed." };
  if (notice === "backfill") return { ok: true, text: detail || "Week generated." };
  if (notice === "published") return { ok: true, text: "Column published." };
  if (notice === "held") return { ok: true, text: detail || "Piece updated." };
  if (notice === "discarded") return { ok: true, text: "Column discarded." };
  if (notice === "connected") return { ok: true, text: "Yahoo is connected." };
  if (notice === "disconnected") return { ok: true, text: "Yahoo was disconnected." };
  if (notice === "sync") return { ok: true, text: detail || "Sync finished." };
  if (notice === "league") return { ok: true, text: detail || "Active league saved." };
  return null;
}

function AdminFallback() {
  return (
    <main className={`${pageWidth} py-8`}>
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">Admin</h1>
      <p className="mt-4 text-muted">Loading admin…</p>
    </main>
  );
}

function Flash({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return (
    <p role="status" className={`mb-6 text-sm ${message.ok ? "text-up" : "text-down"}`}>
      {message.text}
    </p>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`font-display text-sm font-bold uppercase tracking-wide ${ok ? "text-up" : "text-down"}`}>
        {ok ? "Ready" : "Missing"}
      </dd>
    </div>
  );
}

function when(iso: string | null) {
  return iso ? formatAbsoluteTime(iso) : "None yet";
}

function ConnectionCard({
  connection,
  connectionError,
}: {
  connection: YahooConnectionStatus | null;
  connectionError: string | null;
}) {
  const connected = connection?.connected ?? false;
  const access = !connection
    ? "Unknown"
    : !connected
      ? "Not connected"
      : connection.accessCurrent
        ? `Valid until ${when(connection.accessExpiresAt)}`
        : `Expired ${when(connection.accessExpiresAt)}. The next request will refresh it.`;

  return (
    <section className="border border-line bg-surface p-5" aria-labelledby="connections-heading">
      <h2 id="connections-heading" className="font-display text-2xl font-extrabold uppercase tracking-wide">
        Connections
      </h2>
      <dl className="mt-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
          <dt className="text-sm text-muted">Yahoo</dt>
          <dd className={`font-display text-sm font-bold uppercase tracking-wide ${connected ? "text-up" : "text-muted"}`}>
            {connected ? "Connected" : "Not connected"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
          <dt className="text-sm text-muted">Access token</dt>
          <dd className="text-right text-sm">{access}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
          <dt className="text-sm text-muted">Scope</dt>
          <dd className="text-sm">{connection?.scope || "None"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-line py-3">
          <dt className="text-sm text-muted">Token updated</dt>
          <dd className="text-sm">{when(connection?.updatedAt ?? null)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-sm text-muted">Last fetch</dt>
          <dd className="text-sm">{when(connection?.lastFetchAt ?? null)}</dd>
        </div>
      </dl>
      {connectionError ? <p className="mt-2 text-sm text-down">{connectionError}</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={connectYahoo}>
          <PendingButton idle={connected ? "Reconnect" : "Connect"} pending="Opening Yahoo…" />
        </form>
        <form action={disconnectYahoo}>
          <PendingButton idle="Disconnect" pending="Disconnecting…" disabled={!connected} variant="secondary" />
        </form>
        <form action={syncYahoo}>
          <PendingButton idle="Sync" pending="Syncing…" disabled={!connected} variant="secondary" />
        </form>
      </div>
    </section>
  );
}

function LeagueCard({ status, error }: { status: ActiveLeagueStatus | null; error: string | null }) {
  return (
    <section className="border border-line bg-surface p-5" aria-labelledby="league-heading">
      <h2 id="league-heading" className="font-display text-2xl font-extrabold uppercase tracking-wide">
        League
      </h2>
      <p className="mt-2 text-sm text-muted">This newsroom covers one league. Sync Yahoo, then choose it by name.</p>
      {error ? <p className="mt-4 text-sm text-down">{error}</p> : null}
      {status && status.leagues.length === 0 && !error ? (
        <p className="mt-4 text-sm text-muted">{status.message}</p>
      ) : null}
      {status && status.leagues.length > 0 ? (
        <form action={setActiveLeague} className="mt-4">
          <fieldset disabled={status.lockedByEnv} className="flex flex-col gap-2">
            <legend className="sr-only">Active league</legend>
            {status.leagues.map((league) => (
              <label key={league.leagueKey} className="flex items-start gap-3 border border-line px-3 py-2">
                <input
                  type="radio"
                  name="leagueKey"
                  value={league.leagueKey}
                  defaultChecked={league.leagueKey === status.selectedKey}
                  required
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm">{leagueLabel(league)}</span>
                  <span className="block text-sm text-muted">
                    {league.numTeams ?? "—"} teams · Week {league.currentWeek ?? "—"}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {status.message ? <p className="mt-3 text-sm text-muted">{status.message}</p> : null}
          {status.lockedByEnv ? null : (
            <div className="mt-4">
              <PendingButton idle="Save league" pending="Saving…" />
            </div>
          )}
        </form>
      ) : null}
    </section>
  );
}

async function AdminPanel({ searchParams }: { searchParams: Promise<AdminSearch> }) {
  const params = await searchParams;
  const flash = flashMessage(params);
  const password = adminPassword();

  if (!password) {
    return (
      <main className={`${pageWidth} py-8`}>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">Admin</h1>
        <p className="mt-4 max-w-xl text-sm text-muted">
          Admin is locked. Add ADMIN_PASSWORD to .env.local and restart the dev server.
        </p>
      </main>
    );
  }

  const signedIn = await isAdminSession();
  if (!signedIn) {
    return (
      <main className={`${pageWidth} py-8`}>
        <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">Admin</h1>
        <p className="mt-2 text-sm text-muted">Sign in to manage connections.</p>
        <div className="mt-6 max-w-sm border border-line bg-surface p-5">
          <Flash message={flash} />
          <form action={login} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm text-muted">
              Password
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
              />
            </label>
            <PendingButton idle="Sign in" pending="Checking…" />
          </form>
        </div>
      </main>
    );
  }

  const dashboard = await loadAdminDashboard();
  const { settings } = dashboard;
  let columns: OpinionColumnView[] = [];
  let columnsError: string | null = null;
  let held: HeldArticle[] = [];
  let heldError: string | null = null;
  let backfill: BackfillWeek[] = [];
  let backfillError: string | null = null;
  let leagueStatus: ActiveLeagueStatus | null = null;
  let leagueError: string | null = null;
  if (settings.database.ok) {
    try {
      columns = await listReviewColumns();
    } catch (error) {
      columnsError = publicError(error);
    }
    try {
      held = await listHeldArticles();
    } catch (error) {
      heldError = publicError(error);
    }
    try {
      const league = await resolveLeague();
      backfill = await loadBackfillWeeks(league.leagueKey);
    } catch (error) {
      backfillError = publicError(error);
    }
    try {
      leagueStatus = await loadActiveLeagueStatus();
    } catch (error) {
      leagueError = publicError(error);
    }
  } else {
    backfillError = settings.database.message;
    leagueError = settings.database.message;
  }

  return (
    <main className={`${pageWidth} py-8`}>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">FSNN</p>
          <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">Admin</h1>
        </div>
        <form action={logout}>
          <PendingButton idle="Sign out" pending="Signing out…" variant="secondary" />
        </form>
      </div>
      <Flash message={flash} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ConnectionCard connection={dashboard.connection} connectionError={dashboard.connectionError} />
        <LeagueCard status={leagueStatus} error={leagueError} />
        <section className="border border-line bg-surface p-5" aria-labelledby="settings-heading">
          <h2 id="settings-heading" className="font-display text-2xl font-extrabold uppercase tracking-wide">
            Settings
          </h2>
          <dl className="mt-4">
            <Check ok={settings.clientId} label="YAHOO_CLIENT_ID" />
            <Check ok={settings.clientSecret} label="YAHOO_CLIENT_SECRET" />
            <Check ok={settings.minimaxKey} label="MINIMAX_API_KEY" />
            <div className="border-b border-line py-3">
              <dt className="text-sm text-muted">YAHOO_REDIRECT_URI</dt>
              <dd className="mt-1 break-all text-sm">{settings.redirectUri}</dd>
              <p className={`mt-2 text-sm ${settings.redirectMatchesCallback ? "text-muted" : "text-down"}`}>
                {settings.redirectMatchesCallback
                  ? "Yahoo must allow this exact URI."
                  : "Point this at /admin/yahoo/callback on the dev server, and allow that URI on the Yahoo app."}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt className="text-sm text-muted">Database</dt>
              <dd className={`text-right text-sm ${settings.database.ok ? "text-up" : "text-down"}`}>
                {settings.database.ok ? "Reachable" : settings.database.message}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <BreakingSection canWrite={settings.database.ok && settings.minimaxKey} />
      <ColumnsSection
        columns={columns}
        columnsError={columnsError}
        canWrite={settings.database.ok && settings.minimaxKey}
      />
      <HeldSection held={held} heldError={heldError} />
      <BackfillSection
        weeks={backfill}
        error={backfillError}
        canWrite={settings.database.ok && settings.minimaxKey}
      />
    </main>
  );
}

function deskLabel(desk: string) {
  return desk === "waivers" ? "Waivers" : "Results";
}

function BreakingSection({ canWrite }: { canWrite: boolean }) {
  return (
    <section className="mt-6 border border-line bg-surface p-5" aria-labelledby="breaking-heading">
      <h2 id="breaking-heading" className="font-display text-2xl font-extrabold uppercase tracking-wide">
        Breaking
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Publishes one story from the synced tables when a trade, a waiver bid, or a starter injury clears the bar.
        The first run only records what is already on the wire.
      </p>
      <form action={writeBreakingStory} className="mt-4">
        <PendingButton idle="Write breaking story" pending="Writing…" disabled={!canWrite} />
      </form>
    </section>
  );
}

function ColumnsSection({
  columns,
  columnsError,
  canWrite,
}: {
  columns: OpinionColumnView[];
  columnsError: string | null;
  canWrite: boolean;
}) {
  return (
    <section className="mt-6 border border-line bg-surface p-5" aria-labelledby="columns-heading">
      <h2 id="columns-heading" className="font-display text-2xl font-extrabold uppercase tracking-wide">
        Columns
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Writes a draft from the synced league tables. Publish sends it to the opinion rail. A column that misses its
        goal stays here with the editor&apos;s notes.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={writeResultsColumn}>
          <PendingButton idle="Write results column" pending="Writing…" disabled={!canWrite} />
        </form>
        <form action={writeWaiverColumn}>
          <PendingButton idle="Write waiver column" pending="Writing…" disabled={!canWrite} variant="secondary" />
        </form>
      </div>
      {columnsError ? <p className="mt-4 text-sm text-down">{columnsError}</p> : null}
      {columns.length === 0 ? <p className="mt-6 text-sm text-muted">No drafts waiting.</p> : null}
      <div className="mt-6 flex flex-col gap-6">
        {columns.map((column) => (
          <article key={column.id} className="border border-line p-4">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-accent">
              Week {column.week} · {deskLabel(column.desk)}
              {column.status === "needs-edit" ? " · Needs edit" : " · Draft"}
            </p>
            <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight">{column.headline}</h3>
            <p className="mt-2 text-sm text-muted">{column.dek}</p>
            <p className="mt-4 text-sm">{column.brief.claim}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              {column.brief.evidence.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {column.reviewNotes.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-down">
                {column.reviewNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 whitespace-pre-wrap text-sm leading-6">{column.body}</div>
            <p className="mt-3 text-xs text-muted">Saved {formatAbsoluteTime(column.createdAt.toISOString())}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={publishColumn}>
                <input type="hidden" name="id" value={column.id} />
                <PendingButton idle="Publish" pending="Publishing…" />
              </form>
              <form action={discardColumn}>
                <input type="hidden" name="id" value={column.id} />
                <PendingButton idle="Discard" pending="Discarding…" variant="secondary" />
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function kindLabel(kind: HeldArticle["kind"]) {
  return kind === "rankings" ? "Power rankings" : "Recap";
}

function HeldSection({ held, heldError }: { held: HeldArticle[]; heldError: string | null }) {
  return (
    <section className="mt-6 border border-line bg-surface p-5" aria-labelledby="held-heading">
      <h2 id="held-heading" className="font-display text-2xl font-extrabold uppercase tracking-wide">
        Needs edit
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Recaps and power rankings that still miss the goal after three rewrites. They stay off the site until you
        publish or discard them.
      </p>
      {heldError ? <p className="mt-4 text-sm text-down">{heldError}</p> : null}
      {held.length === 0 ? <p className="mt-6 text-sm text-muted">Nothing is waiting.</p> : null}
      <div className="mt-6 flex flex-col gap-6">
        {held.map((piece) => (
          <article key={piece.id} className="border border-line p-4">
            <p className="font-display text-xs font-bold uppercase tracking-wider text-accent">
              Week {piece.week} · {kindLabel(piece.kind)} · Needs edit
            </p>
            <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight">{piece.headline}</h3>
            <p className="mt-2 text-sm text-muted">{piece.dek}</p>
            {piece.notes.length > 0 ? (
              <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-down">
                {piece.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            {piece.body ? <div className="mt-4 whitespace-pre-wrap text-sm leading-6">{piece.body}</div> : null}
            <p className="mt-3 text-xs text-muted">Saved {formatAbsoluteTime(piece.updatedAt.toISOString())}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={publishHeld}>
                <input type="hidden" name="id" value={piece.id} />
                <PendingButton idle="Publish" pending="Publishing…" />
              </form>
              <form action={discardHeld}>
                <input type="hidden" name="id" value={piece.id} />
                <PendingButton idle="Discard" pending="Discarding…" variant="secondary" />
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BackfillSection({
  weeks,
  error,
  canWrite,
}: {
  weeks: BackfillWeek[];
  error: string | null;
  canWrite: boolean;
}) {
  return (
    <section className="mt-6 border border-line bg-surface p-5" aria-labelledby="backfill-heading">
      <h2 id="backfill-heading" className="font-display text-2xl font-extrabold uppercase tracking-wide">
        Backfill
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Sync Yahoo first so the full transaction history is stored. Then generate one week as it stood then: the recap,
        power rankings, both columns, and The Dig. Each piece is dated to that week&apos;s normal slot. Generating
        again overwrites that week.
      </p>
      {error ? <p className="mt-4 text-sm text-down">{error}</p> : null}
      {!error && weeks.length === 0 ? <p className="mt-6 text-sm text-muted">No completed weeks yet.</p> : null}
      <div className="mt-2">
        {weeks.map((week) => {
          const ready = week.recap || week.rankings || week.results || week.waivers || week.podcast;
          return (
            <div
              key={week.week}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
            >
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-wide">Week {week.week}</p>
                <p className="mt-1 text-sm text-muted">
                  {pieceState(week.recap, "Recap")} · {pieceState(week.rankings, "Rankings")} ·{" "}
                  {pieceState(week.results, "Results")} · {pieceState(week.waivers, "Waivers")} ·{" "}
                  {pieceState(week.podcast, "Dig")}
                </p>
                {week.previousRankings ? null : (
                  <p className="mt-1 text-sm text-muted">
                    Week {week.week - 1} has no rankings yet, so movement has nothing to compare.
                  </p>
                )}
              </div>
              <form action={generateBackfillWeek}>
                <input type="hidden" name="week" value={week.week} />
                <PendingButton
                  idle={ready ? `Regenerate week ${week.week}` : `Generate week ${week.week}`}
                  pending="Writing…"
                  disabled={!canWrite}
                />
              </form>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function pieceState(ready: boolean, label: string) {
  return `${label} ${ready ? "ready" : "missing"}`;
}

export default function AdminPage({ searchParams }: { searchParams: Promise<AdminSearch> }) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminPanel searchParams={searchParams} />
    </Suspense>
  );
}
