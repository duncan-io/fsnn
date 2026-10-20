import { cacheLife, cacheTag } from "next/cache";
import type { Article, ArticleKind, League, Matchup, Team } from "@/lib/types";
import {
  articles,
  leadSlugs,
  league,
  matchups,
  teams,
  trendingSlugs,
} from "@/lib/data/fixtures";

/**
 * Newsroom data access. These functions return fixtures today.
 * When the FSNN API is ready, replace the bodies with fetch calls
 * and keep the signatures stable so the page does not have to change.
 */

function byNewest(a: Article, b: Article): number {
  return a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0;
}

function articlesBySlugs(slugs: readonly string[]): Article[] {
  return slugs.flatMap((slug) => {
    const article = articles.find((item) => item.slug === slug);
    return article ? [article] : [];
  });
}

export async function getLeague(): Promise<League> {
  "use cache";
  cacheLife("minutes");
  cacheTag("standings");
  return league;
}

export async function getTeams(): Promise<Team[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("standings");
  return teams;
}

export async function getStandings(): Promise<Team[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("standings");
  return [...teams].sort((a, b) => a.rank - b.rank);
}

export async function getCurrentMatchups(): Promise<Matchup[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("scores");
  return matchups.filter((matchup) => matchup.week === league.currentWeek);
}

export async function getBreakingNews(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  return articles.filter((article) => article.kind === "breaking").sort(byNewest);
}

export async function getLeadStories(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  return articlesBySlugs(leadSlugs);
}

export async function getLatestArticles(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  const featured = new Set<string>(leadSlugs);
  return articles.filter((article) => !featured.has(article.slug)).sort(byNewest);
}

export async function getArticlesByKind(kind: ArticleKind): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  return articles.filter((article) => article.kind === kind).sort(byNewest);
}

export async function getTrending(): Promise<Article[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  return articlesBySlugs(trendingSlugs);
}

export async function getFeaturedInterview(): Promise<Article | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("articles");
  const interviews = articles
    .filter((article) => article.kind === "interview" && article.pullQuote)
    .sort(byNewest);
  return interviews[0] ?? null;
}
