import { personas, type PersonaId } from "../personas/staff";

export const SHOW = {
  title: "The Dig with Greg and Jerry",
  shortTitle: "The Dig",
  hosts: ["greg", "jerry"] as const satisfies readonly PersonaId[],
  summary: "Greg Pell and Jerry Crowe dig into last week's results and argue about next week's matchups.",
};

export function hostNames(): string {
  return SHOW.hosts.map((id) => personas[id].name).join(" and ");
}

export function episodeTitle(week: number, hook: string): string {
  return `${SHOW.shortTitle}, Week ${week}: ${hook.trim()}`;
}
