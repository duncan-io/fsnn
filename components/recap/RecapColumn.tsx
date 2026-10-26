import { ArticleEngagement } from "@/components/engagement/ArticleEngagement";
import type { Article, Team } from "@/lib/types";
import type { RecapBody } from "@/src/recap/types";
import { matchupAnchor } from "@/src/recap/slug";
import { ArticleLead } from "@/components/ui/ArticleLead";
import { KindBadge } from "@/components/ui/KindBadge";
import { ReporterByline } from "@/components/ui/ReporterByline";

type RecapColumnProps = {
  article: Article;
  body: RecapBody;
  teams: Team[];
};

export function RecapColumn({ article, body, teams }: RecapColumnProps) {
  const names = new Map(teams.map((team) => [team.id, team.name]));

  return (
    <article>
      <ArticleLead src={article.imageUrl} />
      <KindBadge kind={article.kind} />
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">
        {article.headline}
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-7 text-muted">{article.dek}</p>
      <div className="mt-4">
        <ReporterByline
          reporter={article.reporter}
          publishedAt={article.publishedAt}
          readTimeMinutes={article.readTimeMinutes}
        />
      </div>
      <div className="mt-8 max-w-2xl space-y-8 text-base leading-7">
        <p>{body.lede}</p>
        {body.sections.map((section) => (
          <section key={section.matchupKey} id={matchupAnchor(section.matchupKey)} className="scroll-mt-24">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">{section.heading}</h2>
            <p className="mt-1 text-sm text-muted">{matchupLabel(section.matchupKey, names)}</p>
            <div className="mt-3 space-y-4">
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.matchupKey}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
        {body.kicker ? <p className="border-t border-line pt-6">{body.kicker}</p> : null}
      </div>
      <ArticleEngagement slug={article.slug} />
    </article>
  );
}

function matchupLabel(matchupKey: string, names: Map<string, string>): string {
  const [left, right] = matchupKey.split(":");
  const home = (left && names.get(left)) ?? left;
  const away = (right && names.get(right)) ?? right;
  return away ? `${home} vs ${away}` : (home ?? "");
}
