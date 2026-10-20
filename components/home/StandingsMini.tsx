import { getStandings } from "@/lib/data";
import { formatPoints, formatRecord } from "@/lib/format";
import { SectionHeader } from "@/components/ui/SectionHeader";

export async function StandingsMini() {
  const standings = await getStandings();

  return (
    <section className="border border-line bg-surface p-4" aria-labelledby="standings-heading">
      <SectionHeader id="standings-heading" title="Standings" href="/standings" />
      <table className="w-full text-left text-sm">
        <caption className="sr-only">The Gridiron Guild standings</caption>
        <thead>
          <tr className="font-display text-[11px] uppercase tracking-wider text-muted">
            <th className="pb-2 font-bold">#</th>
            <th className="pb-2 font-bold">Team</th>
            <th className="pb-2 text-right font-bold">W-L</th>
            <th className="pb-2 text-right font-bold">PF</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => (
            <tr key={team.id} className="border-t border-line">
              <td className="py-2 font-display font-bold text-muted">{team.rank}</td>
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0"
                    style={{ backgroundColor: team.primaryColor }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{team.name}</span>
                    <span className="block text-xs text-muted">{team.managerName}</span>
                  </span>
                </span>
              </td>
              <td className="py-2 text-right font-display font-bold tabular-nums">
                {formatRecord(team)}
              </td>
              <td className="py-2 text-right tabular-nums text-muted">{formatPoints(team.pointsFor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
