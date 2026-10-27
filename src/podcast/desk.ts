import { and, desc, eq, lt, lte } from "drizzle-orm";
import { getDb } from "../db/client";
import { articles, opinionColumns, podcastEpisodes } from "../db/schema";

export type RecapCard = {
  matchupKey: string;
  writer: string;
  headline: string;
  dek: string;
  heading: string;
  sentence: string;
  teamNames: string[];
};

export type RankingsLine = {
  week: number;
  writer: string;
  headline: string;
  teamKey: string;
  teamName: string;
  sentence: string;
};

export type ColumnCard = {
  writer: string;
  desk: string;
  headline: string;
  claim: string;
  counter: string;
  teamKeys: string[];
  teamNames: string[];
  week: number;
};

export type LastShowSection = {
  angle: string;
  jerry: string;
  greg: string;
};

export type LastShowCard = {
  week: number;
  title: string;
  sections: LastShowSection[];
};

export type DeskContext = {
  recaps: RecapCard[];
  rankings: RankingsLine[];
  columns: ColumnCard[];
  lastShow: LastShowCard | null;
};

export const EMPTY_DESK: DeskContext = {
  recaps: [],
  rankings: [],
  columns: [],
  lastShow: null,
};

export function recapCards(source: {
  writer: string;
  body: unknown;
  cards: Array<{ matchupKey: string | null; headline: string; dek: string }>;
  names?: ReadonlyMap<string, string[]>;
}): RecapCard[] {
  return recapSections(source.body).flatMap((section) => {
    const card = source.cards.find((item) => item.matchupKey === section.matchupKey);
    return [
      {
        matchupKey: section.matchupKey,
        writer: source.writer,
        headline: card?.headline.trim() || section.heading,
        dek: card?.dek.trim() ?? "",
        heading: section.heading,
        sentence: section.sentence,
        teamNames: source.names?.get(section.matchupKey) ?? [],
      },
    ];
  });
}

export function rankingsLines(source: {
  week: number;
  writer: string;
  headline: string;
  body: unknown;
  teams: Array<{ teamKey: string; teamName: string }>;
}): RankingsLine[] {
  const names = new Map(source.teams.map((team) => [team.teamKey, team.teamName]));
  return rankingsEntries(source.body).flatMap((entry) => {
    const teamName = names.get(entry.teamKey);
    if (!teamName) return [];
    return [
      {
        week: source.week,
        writer: source.writer,
        headline: source.headline,
        teamKey: entry.teamKey,
        teamName,
        sentence: entry.sentence,
      },
    ];
  });
}

export function columnCard(source: {
  status: string;
  writer: string;
  desk: string;
  headline: string;
  week: number;
  teamKeys: unknown;
  teamNames?: string[];
  brief: unknown;
}): ColumnCard | null {
  if (source.status !== "published") return null;
  const claim = textField(source.brief, "claim");
  if (!claim) return null;
  const counterLines = source.brief && typeof source.brief === "object" ? (source.brief as { counterEvidence?: unknown }).counterEvidence : undefined;
  const counter = Array.isArray(counterLines) ? counterLines.find((line): line is string => typeof line === "string" && line.trim().length > 0) : undefined;
  return {
    writer: source.writer,
    desk: source.desk,
    headline: source.headline.trim(),
    claim,
    counter: counter?.trim() ?? "",
    teamKeys: stringList(source.teamKeys),
    teamNames: source.teamNames ?? [],
    week: source.week,
  };
}

export function lastShowCard(week: number, title: string, script: unknown): LastShowCard | null {
  const outline = script && typeof script === "object" ? (script as { outline?: unknown }).outline : undefined;
  const sections = outline && typeof outline === "object" ? (outline as { sections?: unknown }).sections : undefined;
  if (!Array.isArray(sections)) return null;
  const kept = sections.flatMap((section) => {
    if (!section || typeof section !== "object") return [];
    const angle = textField(section, "angle");
    const jerry = textField(section, "jerry");
    const greg = textField(section, "greg");
    if (!angle || !jerry || !greg) return [];
    return [{ angle, jerry, greg }];
  });
  if (kept.length === 0) return null;
  return { week, title: title.trim(), sections: kept };
}

export async function loadDesk(leagueKey: string, week: number): Promise<DeskContext> {
  const db = getDb();
  const [storyRows, rankingsRow, columnRows, showRow] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(and(eq(articles.leagueKey, leagueKey), eq(articles.week, week), eq(articles.status, "published"))),
    db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.leagueKey, leagueKey),
          eq(articles.scope, "power-rankings"),
          eq(articles.status, "published"),
          lt(articles.week, week),
        ),
      )
      .orderBy(desc(articles.week))
      .limit(1),
    db
      .select()
      .from(opinionColumns)
      .where(and(eq(opinionColumns.leagueKey, leagueKey), eq(opinionColumns.status, "published"), lte(opinionColumns.week, week)))
      .orderBy(desc(opinionColumns.week)),
    db
      .select()
      .from(podcastEpisodes)
      .where(and(eq(podcastEpisodes.leagueKey, leagueKey), lt(podcastEpisodes.week, week)))
      .orderBy(desc(podcastEpisodes.week))
      .limit(1),
  ]);
  const league = storyRows.find((row) => row.scope === "league");
  const names = matchupNames(league?.factSheet);
  const recaps = league
    ? recapCards({
        writer: league.reporterName,
        body: league.body,
        cards: storyRows
          .filter((row) => row.scope === "matchup")
          .map((row) => ({ matchupKey: row.matchupKey, headline: row.headline, dek: row.dek })),
        names,
      })
    : [];
  const rankingsArticle = rankingsRow[0];
  const rankings = rankingsArticle
    ? rankingsLines({
        week: rankingsArticle.week,
        writer: rankingsArticle.reporterName,
        headline: rankingsArticle.headline,
        body: rankingsArticle.body,
        teams: rankingTeams(rankingsArticle.factSheet),
      })
    : [];
  const directory = teamDirectory(league?.factSheet);
  for (const line of rankings) directory.set(line.teamKey, line.teamName);
  const columns = columnRows.flatMap((row) => {
    const card = columnCard({
      status: row.status,
      writer: row.columnistName,
      desk: row.desk,
      headline: row.headline,
      week: row.week,
      teamKeys: row.teamKeys,
      teamNames: namesForKeys(row.teamKeys, directory),
      brief: row.brief,
    });
    return card ? [card] : [];
  });
  const previous = showRow[0];
  return {
    recaps,
    rankings,
    columns,
    lastShow: previous ? lastShowCard(previous.week, previous.title, previous.script) : null,
  };
}

function recapSections(body: unknown): Array<{ matchupKey: string; heading: string; sentence: string }> {
  if (!body || typeof body !== "object" || !Array.isArray((body as { sections?: unknown }).sections)) return [];
  return (body as { sections: unknown[] }).sections.flatMap((section) => {
    if (!section || typeof section !== "object") return [];
    const matchupKey = (section as { matchupKey?: unknown }).matchupKey;
    const heading = (section as { heading?: unknown }).heading;
    const paragraphs = (section as { paragraphs?: unknown }).paragraphs;
    const sentence = Array.isArray(paragraphs) && typeof paragraphs[0] === "string" && paragraphs[0].trim() ? paragraphs[0] : undefined;
    if (typeof matchupKey !== "string" || typeof heading !== "string" || !sentence) return [];
    return [{ matchupKey, heading: heading.trim(), sentence: sentence.trim() }];
  });
}

function rankingsEntries(body: unknown): Array<{ teamKey: string; sentence: string }> {
  if (!body || typeof body !== "object" || !Array.isArray((body as { entries?: unknown }).entries)) return [];
  return (body as { entries: unknown[] }).entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const teamKey = (entry as { teamKey?: unknown }).teamKey;
    const paragraphs = (entry as { paragraphs?: unknown }).paragraphs;
    const sentence = Array.isArray(paragraphs) && typeof paragraphs[0] === "string" && paragraphs[0].trim() ? paragraphs[0] : undefined;
    if (typeof teamKey !== "string" || !sentence) return [];
    return [{ teamKey, sentence: sentence.trim() }];
  });
}

function matchupNames(factSheet: unknown): Map<string, string[]> {
  const names = new Map<string, string[]>();
  if (!factSheet || typeof factSheet !== "object" || !Array.isArray((factSheet as { matchups?: unknown }).matchups)) return names;
  for (const matchup of (factSheet as { matchups: unknown[] }).matchups) {
    if (!matchup || typeof matchup !== "object") continue;
    const key = (matchup as { matchupKey?: unknown }).matchupKey;
    if (typeof key !== "string") continue;
    const winner = teamNameOf((matchup as { winner?: unknown }).winner);
    const loser = teamNameOf((matchup as { loser?: unknown }).loser);
    names.set(key, [winner, loser].filter((name): name is string => !!name));
  }
  return names;
}

function rankingTeams(factSheet: unknown): Array<{ teamKey: string; teamName: string }> {
  if (!factSheet || typeof factSheet !== "object" || !Array.isArray((factSheet as { teams?: unknown }).teams)) return [];
  return (factSheet as { teams: unknown[] }).teams.flatMap((team) => {
    if (!team || typeof team !== "object") return [];
    const teamKey = (team as { teamKey?: unknown }).teamKey;
    const teamName = (team as { teamName?: unknown }).teamName;
    if (typeof teamKey !== "string" || typeof teamName !== "string" || !teamName.trim()) return [];
    return [{ teamKey, teamName: teamName.trim() }];
  });
}

function teamDirectory(factSheet: unknown): Map<string, string> {
  const names = new Map<string, string>();
  if (!factSheet || typeof factSheet !== "object" || !Array.isArray((factSheet as { matchups?: unknown }).matchups)) return names;
  for (const matchup of (factSheet as { matchups: unknown[] }).matchups) {
    if (!matchup || typeof matchup !== "object") continue;
    for (const side of [(matchup as { winner?: unknown }).winner, (matchup as { loser?: unknown }).loser]) {
      if (!side || typeof side !== "object") continue;
      const teamKey = (side as { teamKey?: unknown }).teamKey;
      const teamName = (side as { teamName?: unknown }).teamName;
      if (typeof teamKey === "string" && typeof teamName === "string" && teamName.trim()) names.set(teamKey, teamName.trim());
    }
  }
  return names;
}

function namesForKeys(teamKeys: unknown, directory: Map<string, string>): string[] {
  return stringList(teamKeys).flatMap((key) => {
    const name = directory.get(key);
    return name ? [name] : [];
  });
}

function teamNameOf(side: unknown): string | null {
  if (!side || typeof side !== "object") return null;
  const name = (side as { teamName?: unknown }).teamName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function textField(value: unknown, key: string): string {
  if (!value || typeof value !== "object" || !(key in value)) return "";
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field.trim() : "";
}

export function formatRecap(card: RecapCard): string {
  return `Desk recap by ${card.writer}. ${card.headline}. ${card.dek}. ${card.sentence}`;
}

export function formatRankings(line: RankingsLine): string {
  return `Rankings week ${line.week} by ${line.writer}. ${line.headline}. ${line.teamName}: ${line.sentence}`;
}

export function formatColumn(card: ColumnCard): string {
  return `${card.writer} on ${card.desk}. ${card.headline}. ${card.claim}. Counter: ${card.counter}`;
}

export function formatLastShow(card: LastShowCard): string {
  const sections = card.sections.map((section) => `${section.angle} Jerry: ${section.jerry} Greg: ${section.greg}`).join(" ");
  return `Last show week ${card.week}. ${card.title}. ${sections}`;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}
