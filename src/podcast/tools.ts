import type { DraftTool } from "../minimax/draft";
import {
  formatColumn,
  formatLastShow,
  formatRankings,
  formatRecap,
  type DeskContext,
} from "./desk";

const STORY_MISS = "No story for that club.";
const RANKINGS_MISS = "No rankings line for that club.";
const SHOW_MISS = "No earlier episode.";

export function deskTools(desk: DeskContext): DraftTool[] {
  return [
    {
      spec: {
        type: "function",
        function: {
          name: "lookup_story",
          description: "Look up the published recap card or column for a team or a matchup already on the desk.",
          parameters: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
      },
      run: async (args) => {
        const name = readName(args);
        const recap = name ? desk.recaps.find((card) => matches(name, [card.headline, card.heading, card.matchupKey, ...card.teamNames])) : undefined;
        if (recap) return hit(formatRecap(recap));
        const column = name ? desk.columns.find((card) => matches(name, [card.headline, ...card.teamNames])) : undefined;
        if (column) return hit(formatColumn(column));
        return miss(STORY_MISS);
      },
    },
    {
      spec: {
        type: "function",
        function: {
          name: "lookup_rankings",
          description: "Look up one club's line from the latest published power rankings on the desk.",
          parameters: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: { name: { type: "string" } },
          },
        },
      },
      run: async (args) => {
        const name = readName(args);
        const line = name ? desk.rankings.find((item) => matches(name, [item.teamName])) : undefined;
        return line ? hit(formatRankings(line)) : miss(RANKINGS_MISS);
      },
    },
    {
      spec: {
        type: "function",
        function: {
          name: "lookup_last_show",
          description: "Look up the previous episode outline, with each section's angle and both hosts' stances.",
          parameters: { type: "object", additionalProperties: false, properties: {} },
        },
      },
      run: async () => (desk.lastShow ? hit(formatLastShow(desk.lastShow)) : miss(SHOW_MISS)),
    },
  ];
}

function hit(content: string): { content: string; snippet: string } {
  return { content, snippet: content };
}

function miss(content: string): { content: string; snippet: null } {
  return { content, snippet: null };
}

function readName(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { name?: unknown };
    return typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null;
  } catch {
    return null;
  }
}

function matches(query: string, fields: string[]): boolean {
  const needle = normalize(query);
  if (!needle) return false;
  return fields.some((field) => {
    const hay = normalize(field);
    return hay === needle || hay.split(" ").includes(needle);
  });
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
