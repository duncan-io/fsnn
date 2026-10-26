import type { Team } from "@/lib/types";
import { teamAbbreviation, teamColor } from "../recap/display";
import type { RankingsBrief } from "./types";

export function teamsFromRankings(brief: RankingsBrief): Team[] {
  return brief.teams.map((team) => ({
    id: team.teamKey,
    name: team.teamName,
    abbreviation: teamAbbreviation(team.teamName),
    managerName: team.managerName ?? "Manager",
    primaryColor: teamColor(team.teamKey),
    secondaryColor: "#141418",
    record: { wins: team.wins, losses: team.losses, ties: team.ties },
    pointsFor: team.pointsFor,
    pointsAgainst: team.pointsAgainst,
    rank: team.rank,
    previousRank: team.previousRank,
    streak: team.streak,
  }));
}
