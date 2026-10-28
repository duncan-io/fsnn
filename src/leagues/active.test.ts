import { describe, expect, test } from "bun:test";
import { pickActiveLeague } from "./active";

const guild = "461.l.1000";
const other = "461.l.2000";

describe("pickActiveLeague", () => {
  test("uses LEAGUE_KEY ahead of a stored choice", () => {
    const pick = pickActiveLeague({
      envKey: guild,
      storedKey: other,
      leagueKeys: [guild, other],
    });
    expect(pick).toEqual({ ok: true, leagueKey: guild });
  });

  test("rejects an env key that has not been synced", () => {
    const pick = pickActiveLeague({
      envKey: "461.l.missing",
      storedKey: guild,
      leagueKeys: [guild],
    });
    expect(pick).toEqual({
      ok: false,
      message: "No league stored for 461.l.missing. Sync Yahoo first.",
    });
  });

  test("uses the stored league when more than one is synced", () => {
    const pick = pickActiveLeague({
      storedKey: other,
      leagueKeys: [guild, other],
    });
    expect(pick).toEqual({ ok: true, leagueKey: other });
  });

  test("falls through a stale stored key to the only remaining league", () => {
    const pick = pickActiveLeague({
      storedKey: "461.l.gone",
      leagueKeys: [guild],
    });
    expect(pick).toEqual({ ok: true, leagueKey: guild });
  });

  test("asks for a choice when a stale key leaves several leagues", () => {
    const pick = pickActiveLeague({
      storedKey: "461.l.gone",
      leagueKeys: [guild, other],
    });
    expect(pick).toEqual({ ok: false, message: "Pick an active league in Admin." });
  });

  test("uses the only synced league when nothing is saved", () => {
    const pick = pickActiveLeague({ leagueKeys: [guild] });
    expect(pick).toEqual({ ok: true, leagueKey: guild });
  });

  test("asks for a sync when no leagues are stored", () => {
    const pick = pickActiveLeague({ leagueKeys: [] });
    expect(pick).toEqual({ ok: false, message: "No leagues stored. Sync Yahoo first." });
  });

  test("asks Admin to choose when several leagues are synced", () => {
    const pick = pickActiveLeague({ envKey: "  ", storedKey: "", leagueKeys: [guild, other] });
    expect(pick).toEqual({ ok: false, message: "Pick an active league in Admin." });
  });
});
