import Link from "next/link";
import { getFeaturedInterview, getTeams } from "@/lib/data";
import { lookupTeams } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function ManagerMic() {
  const [interview, teams] = await Promise.all([getFeaturedInterview(), getTeams()]);
  if (!interview?.pullQuote) return null;

  const [team] = lookupTeams(interview.teamIds, teams);

  return (
    <section className="border border-line bg-surface p-4" aria-labelledby="mic-heading">
      <SectionHeader
        id="mic-heading"
        title="Manager Mic"
        href="/interviews"
        action="All interviews"
      />
      <blockquote>
        <p className="font-display text-2xl font-extrabold leading-tight tracking-tight">
          “{interview.pullQuote.text}”
        </p>
        <footer className="mt-4 text-sm text-muted">
          <span className="font-medium text-foreground">{interview.pullQuote.managerName}</span>
          {team ? <span> · {team.name}</span> : null}
        </footer>
      </blockquote>
      <Link
        href={`/articles/${interview.slug}`}
        className="mt-4 inline-block font-display text-xs font-bold uppercase tracking-wider text-accent hover:underline"
      >
        Read the interview
      </Link>
    </section>
  );
}
