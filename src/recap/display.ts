import type { Team } from "@/lib/types";
import type { WeekBrief } from "./types";

const COLORS = [
  "#7C4DFF",
  "#E23B2F",
  "#1F6AA5",
  "#E0B325",
  "#1F9D4A",
  "#1F8A9C",
  "#C45C26",
  "#8E3B8A",
  "#D4537E",
  "#3E7D6B",
  "#4C6EF5",
  "#B45309",
];

export function teamAbbreviation(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "FS";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function teamColor(teamKey: string): string {
  let hash = 0;
  for (const char of teamKey) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length] ?? COLORS[0];
}

export function teamsFromBrief(brief: WeekBrief): Team[] {
  const teams: Team[] = [];
  const seen = new Set<string>();
  for (const matchup of brief.matchups) {
    for (const side of [matchup.winner, matchup.loser]) {
      if (seen.has(side.teamKey)) continue;
      seen.add(side.teamKey);
      teams.push({
        id: side.teamKey,
        name: side.teamName,
        abbreviation: teamAbbreviation(side.teamName),
        managerName: side.managerName ?? "Manager",
        primaryColor: teamColor(side.teamKey),
        secondaryColor: "#141418",
        record: side.record,
        pointsFor: side.pointsFor,
        pointsAgainst: side.pointsAgainst,
        rank: side.rankAfter,
        previousRank: side.rankBefore,
        streak: side.streak,
      });
    }
  }
  return teams;
}

export function readTimeMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
