import { ArticleEngagement } from "@/components/engagement/ArticleEngagement";
import { ArticleLead } from "@/components/ui/ArticleLead";
import { KindBadge } from "@/components/ui/KindBadge";
import { ReporterByline } from "@/components/ui/ReporterByline";
import { pageWidth } from "@/lib/labels";
import type { BreakingStory } from "@/src/breaking/store";

export function BreakingStoryView({ story }: { story: BreakingStory }) {
  const paragraphs = story.body.split(/\n\n+/).filter((paragraph) => paragraph.trim());
  const words = story.body.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className={`${pageWidth} py-8`}>
      <article className="max-w-2xl">
        <ArticleLead src={story.imageUrl} />
        <KindBadge kind="breaking" />
        <h1 className="mt-3 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
          {story.headline}
        </h1>
        <p className="mt-4 text-lg leading-7 text-muted">{story.dek}</p>
        <div className="mt-4">
          <ReporterByline
            reporter={{
              name: story.reporterName,
              beat: story.reporterBeat,
              initials: story.reporterInitials,
            }}
            publishedAt={story.publishedAt.toISOString()}
            readTimeMinutes={Math.max(1, Math.round(words / 220))}
          />
        </div>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-8">
          {paragraphs.map((paragraph, index) => (
            <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
          ))}
        </div>
        <ArticleEngagement slug={story.slug} />
      </article>
    </main>
  );
}
