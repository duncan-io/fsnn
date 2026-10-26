import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPodcastEpisode } from "@/lib/data/podcast";
import { pageWidth } from "@/lib/labels";
import { personas } from "@/src/personas/staff";
import { SHOW } from "@/src/podcast/show";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const episode = await getPodcastEpisode(slug);
  if (!episode) return { title: SHOW.title };
  return { title: episode.title, description: episode.description };
}

export default function PodcastEpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense
      fallback={
        <main className={`${pageWidth} py-8`}>
          <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">{SHOW.shortTitle}</p>
          <p className="mt-6 max-w-xl text-muted">Opening the episode…</p>
        </main>
      }
    >
      <EpisodeContent params={params} />
    </Suspense>
  );
}

async function EpisodeContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = await getPodcastEpisode(slug);
  if (!episode) notFound();
  const angles = new Map(episode.script.outline.sections.map((section) => [section.id, section.angle]));

  return (
    <main className={`${pageWidth} py-8`}>
      <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">
        <Link href="/podcast">{SHOW.shortTitle}</Link>
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-4xl font-extrabold tracking-tight">{episode.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{episode.description}</p>
      <p className="mt-2 text-sm text-muted">
        Week {episode.week} · {Math.max(1, Math.round(episode.durationSeconds / 60))} min
      </p>
      <audio className="mt-6 w-full max-w-2xl" controls preload="none" src={episode.audioPath}>
        <a href={episode.audioPath}>Listen</a>
      </audio>
      <div className="mt-10 max-w-2xl space-y-8">
        {episode.script.segments.map((segment) => (
          <section key={segment.id}>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-accent">
              {angles.get(segment.id) ?? segment.kind}
            </h2>
            <div className="mt-3 space-y-3">
              {segment.lines.map((line, index) => {
                const host = personas[line.speaker];
                return (
                  <p key={`${segment.id}-${index}`}>
                    <span className="mr-2 inline-grid size-6 place-items-center rounded-full bg-surface-raised align-middle font-display text-[10px] font-bold text-accent">
                      {host.initials}
                    </span>
                    <span className="font-medium">{host.name}. </span>
                    {line.text}
                  </p>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
