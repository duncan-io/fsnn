import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getPodcastEpisodes } from "@/lib/data/podcast";
import { pageWidth } from "@/lib/labels";
import { personas } from "@/src/personas/staff";
import { SHOW } from "@/src/podcast/show";

export const metadata: Metadata = {
  title: SHOW.title,
  description: SHOW.summary,
};

export default function PodcastPage() {
  return (
    <Suspense
      fallback={
        <main className={`${pageWidth} py-8`}>
          <ShowHeading />
          <p className="mt-6 max-w-xl text-muted">Opening the show…</p>
        </main>
      }
    >
      <PodcastContent />
    </Suspense>
  );
}

async function PodcastContent() {
  const episodes = await getPodcastEpisodes();

  return (
    <main className={`${pageWidth} py-8`}>
      <ShowHeading />
      <p className="mt-4">
        <a href="/podcast/feed.xml" className="font-display text-sm font-bold uppercase tracking-wider text-accent">
          Subscribe
        </a>
      </p>
      {episodes.length === 0 ? (
        <p className="mt-6 max-w-xl text-muted">The Tuesday show has not been filed. It lands after the week is final.</p>
      ) : (
        <ul className="mt-8 max-w-2xl space-y-8">
          {episodes.map((episode) => (
            <li key={episode.id} className="border-t border-line pt-6">
              <Link href={`/podcast/${episode.slug}`} className="font-display text-2xl font-extrabold tracking-tight">
                {episode.title}
              </Link>
              <p className="mt-2 text-sm text-muted">
                Week {episode.week} · {minutes(episode.durationSeconds)}
              </p>
              <p className="mt-3 max-w-xl text-foreground/80">{episode.description}</p>
              <audio className="mt-4 w-full" controls preload="none" src={episode.audioPath}>
                <a href={episode.audioPath}>Listen</a>
              </audio>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ShowHeading() {
  return (
    <>
      <p className="font-display text-xs font-bold uppercase tracking-[0.16em] text-accent">Podcast</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{SHOW.title}</h1>
      <p className="mt-3 max-w-xl text-muted">{SHOW.summary}</p>
      <ul className="mt-4 flex gap-4">
        {SHOW.hosts.map((id) => (
          <li key={id} className="flex items-center gap-2 text-sm">
            <span className="grid size-6 place-items-center rounded-full bg-surface-raised font-display text-[10px] font-bold text-accent">
              {personas[id].initials}
            </span>
            <span className="font-medium">{personas[id].name}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function minutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}
