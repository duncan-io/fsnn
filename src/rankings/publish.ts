import { getDb } from "../db/client";
import { articles } from "../db/schema";
import type { Persona } from "../personas/staff";
import { rankingsSlug } from "./slug";
import type { RankingsBody, RankingsBrief, RankingsDraft } from "./types";

export async function saveRankings(
  brief: RankingsBrief,
  draft: RankingsDraft,
  persona: Persona,
  release: { status: "published" | "needs-edit"; publishedAt: Date | null; reviewNotes: string[] | null },
) {
  const db = getDb();
  const body: RankingsBody = {
    lede: draft.lede,
    entries: draft.entries,
    kicker: draft.kicker,
  };
  await db
    .insert(articles)
    .values({
      leagueKey: brief.leagueKey,
      week: brief.week,
      scope: "power-rankings",
      matchupKey: null,
      slug: rankingsSlug(brief.leagueKey, brief.week),
      headline: draft.headline,
      dek: draft.dek,
      body,
      teamKeys: brief.teams.map((team) => team.teamKey),
      reporterName: persona.name,
      reporterBeat: persona.beat,
      reporterInitials: persona.initials,
      publishedAt: release.publishedAt,
      status: release.status,
      reviewNotes: release.reviewNotes,
      factSheet: brief,
    })
    .onConflictDoUpdate({
      target: [articles.leagueKey, articles.week, articles.scope, articles.matchupKey],
      set: {
        slug: rankingsSlug(brief.leagueKey, brief.week),
        headline: draft.headline,
        dek: draft.dek,
        body,
        teamKeys: brief.teams.map((team) => team.teamKey),
        factSheet: brief,
        publishedAt: release.publishedAt,
        status: release.status,
        reviewNotes: release.reviewNotes,
        updatedAt: new Date(),
      },
    });
}
