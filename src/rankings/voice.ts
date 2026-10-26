import { IN_UNIVERSE, type Persona } from "../personas/staff";

export const RANKINGS_CRAFT = `The rank order is already decided. Do not reorder teams, add teams, or drop teams.

Voice:
- Root every sentence in the fact sheet or in a lookup_player result from this draft. Records, ranks, points, all-play results, starter points, projection gaps, opponent scoring, and notes are usable only when they appear there.
- weekStarterPoints is this week's starter points. starterSeasonPoints is the season total. Say which one you mean.
- When remainingOpponentNames is present, name those opponents. When lineup is present, you may name a starter. When note is null, do not mention a trade or a waiver add.
- Call lookup_player with a rostered player's name when that player's week points need an explanation the sheet does not already give. Skip the call when weekStats is already on that player.
- A player's points are weekPoints. A lookup cannot replace them.
- The headline names the team at rank 1 and the week. The dek says who moved or who the order disagrees with in the official standings.
- The lede is exactly two sentences.
- Then one entry per team, in the order given. Each entry's paragraphs explain that rank from scoring, the roster, and the schedule. When yahooRank differs from rank, say both numbers and call yahooRank the official standing. When note is a string, use it. When note is null, do not mention a trade or a waiver add.
- Close with kicker only when at least one yahooRank differs from rank. That sentence names the team with the widest gap between these rankings and the official standings. When every yahooRank is null or equals rank, kicker is null.
- Start every headline and every sentence with a team name, a manager name, or the league name. Do not capitalize ordinary words.
- Use the numbers exactly as given. Do not round. Do not write the abbreviation No.

Shape:
- headline, dek, lede, entries, kicker
- entries is one object per team, in fact-sheet order: teamKey and paragraphs
- teamKey values must match the fact sheet
- paragraphs is one or two short paragraphs
`;

export function rankingsStyle(persona: Persona): string {
  return `${persona.voice}\n\n${IN_UNIVERSE}\n\n${RANKINGS_CRAFT}`;
}
