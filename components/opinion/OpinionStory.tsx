import { ReporterByline } from "@/components/ui/ReporterByline";
import { pageWidth } from "@/lib/labels";
import type { OpinionColumnView } from "@/src/opinion/store";

export function OpinionStory({ column }: { column: OpinionColumnView }) {
  const paragraphs = column.body.split(/\n\n+/).filter((paragraph) => paragraph.trim());
  const publishedAt = (column.publishedAt ?? column.createdAt).toISOString();
  const words = column.body.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className={`${pageWidth} py-8`}>
      <article className="max-w-2xl">
        <p className="font-display text-xs font-bold uppercase tracking-wider text-accent">
          Opinion · Week {column.week} · {column.desk === "waivers" ? "Waivers" : "Results"}
        </p>
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
          {column.headline}
        </h1>
        <p className="mt-4 text-lg leading-7 text-muted">{column.dek}</p>
        <div className="mt-4">
          <ReporterByline
            reporter={{
              name: column.columnistName,
              beat: column.columnistBeat,
              initials: column.columnistInitials,
            }}
            publishedAt={publishedAt}
            readTimeMinutes={Math.max(1, Math.round(words / 220))}
          />
        </div>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-8">
          {paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))}
        </div>
        <aside className="mt-10 border border-line bg-surface p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-accent">The case</h2>
          <p className="mt-3 text-sm leading-6">{column.brief.claim}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            {column.brief.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <h3 className="mt-5 font-display text-sm font-bold uppercase tracking-wider">The other side</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
            {column.brief.counterEvidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      </article>
    </main>
  );
}
