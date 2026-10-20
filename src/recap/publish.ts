import { getDb } from "../db/client";
import { articles } from "../db/schema";
import { recapSlug } from "./slug";
import { RECAP_REPORTER, type RecapBody, type RecapDraft, type WeekBrief } from "./types";

export async function saveRecap(brief: WeekBrief, draft: RecapDraft) {
  const db = getDb();
  const publishedAt = new Date();
  await db.transaction(async (tx) => {
    await upsert(tx, {
      leagueKey: brief.leagueKey,
      week: brief.week,
      scope: "league",
      matchupKey: null,
      slug: recapSlug(brief.leagueKey, brief.week, null),
      headline: draft.column.headline,
      dek: draft.column.dek,
      body: {
        lede: draft.column.lede,
        sections: draft.column.sections,
        kicker: draft.column.kicker,
      },
      teamKeys: teamKeys(brief, null),
      publishedAt,
      factSheet: brief,
    });
    for (const card of draft.cards) {
      await upsert(tx, {
        leagueKey: brief.leagueKey,
        week: brief.week,
        scope: "matchup",
        matchupKey: card.matchupKey,
        slug: recapSlug(brief.leagueKey, brief.week, card.matchupKey),
        headline: card.headline,
        dek: card.dek,
        body: null,
        teamKeys: teamKeys(brief, card.matchupKey),
        publishedAt,
        factSheet: brief,
      });
    }
  });
}

type RecapWriter = Pick<ReturnType<typeof getDb>, "insert">;

async function upsert(
  tx: RecapWriter,
  row: {
    leagueKey: string;
    week: number;
    scope: string;
    matchupKey: string | null;
    slug: string;
    headline: string;
    dek: string;
    body: RecapBody | null;
    teamKeys: string[];
    publishedAt: Date;
    factSheet: WeekBrief;
  },
) {
  await tx
    .insert(articles)
    .values({
      ...row,
      reporterName: RECAP_REPORTER.name,
      reporterBeat: RECAP_REPORTER.beat,
      reporterInitials: RECAP_REPORTER.initials,
    })
    .onConflictDoUpdate({
      target: [articles.leagueKey, articles.week, articles.scope, articles.matchupKey],
      set: {
        slug: row.slug,
        headline: row.headline,
        dek: row.dek,
        body: row.body,
        teamKeys: row.teamKeys,
        factSheet: row.factSheet,
        updatedAt: new Date(),
      },
    });
}

function teamKeys(brief: WeekBrief, matchupKey: string | null): string[] {
  if (!matchupKey) {
    return [...new Set(brief.matchups.flatMap((matchup) => [matchup.winner.teamKey, matchup.loser.teamKey]))];
  }
  const matchup = brief.matchups.find((item) => item.matchupKey === matchupKey);
  return matchup ? [matchup.winner.teamKey, matchup.loser.teamKey] : [];
}
