const home = { href: "/", label: "Home" } as const;
const recaps = { href: "/recaps", label: "Recaps" } as const;
const breaking = { href: "/breaking", label: "Breaking" } as const;
const interviews = { href: "/interviews", label: "Interviews" } as const;
const rankings = { href: "/power-rankings", label: "Power Rankings" } as const;
const podcast = { href: "/podcast", label: "The Dig" } as const;
const standings = { href: "/standings", label: "Standings" } as const;

export const newsLinks = [recaps, interviews, rankings] as const;

/** Flat list used by the footer. */
export const navLinks = [home, recaps, breaking, interviews, rankings, podcast, standings] as const;

export type NavLink = { readonly href: string; readonly label: string };

export type NavGroup = { readonly label: string; readonly links: readonly NavLink[] };

export type NavEntry = NavLink | NavGroup;

export const headerNav = [
  home,
  { label: "News", links: newsLinks },
  breaking,
  podcast,
  standings,
] as const satisfies readonly NavEntry[];

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "links" in entry;
}
