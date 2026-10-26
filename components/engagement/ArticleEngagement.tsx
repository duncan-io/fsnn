import Link from "next/link";
import { io } from "next/cache";
import { PendingButton } from "@/components/admin/PendingButton";
import { CommentComposer } from "@/components/engagement/CommentComposer";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { deleteComment, toggleLike } from "@/app/readers/actions";
import { currentReader } from "@/src/readers/session";
import { engagementFor, engagementForSlugs, listComments, readerLiked } from "@/src/readers/store";

export async function ArticleEngagement({ slug }: { slug: string }) {
  if (!process.env.DATABASE_URL) {
    return (
      <section className="mt-10 max-w-2xl border-t border-line pt-6" aria-label="Likes and comments">
        <p className="text-sm text-muted">Likes and comments are unavailable.</p>
      </section>
    );
  }

  await io();
  const reader = await currentReader();
  const [counts, comments, liked] = await Promise.all([
    engagementForSlugs([slug]),
    listComments(slug),
    reader ? readerLiked(reader.id, slug) : Promise.resolve(false),
  ]);
  const { likes, comments: commentCount } = engagementFor(counts, slug);
  const signInHref = `/sign-in?next=${encodeURIComponent(`/articles/${slug}`)}`;
  const likeLabel = `${liked ? "Liked" : "Like"} · ${likes}`;

  return (
    <section id="comments" className="mt-10 max-w-2xl border-t border-line pt-6">
      {reader ? (
        <form action={toggleLike}>
          <input type="hidden" name="slug" value={slug} />
          <PendingButton idle={likeLabel} pending="Saving…" variant={liked ? "primary" : "secondary"} />
        </form>
      ) : (
        <Link
          href={signInHref}
          className="inline-flex border border-line px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wide hover:border-accent hover:text-accent"
        >
          {likeLabel}
        </Link>
      )}

      <h2 className="mt-8 font-display text-2xl font-extrabold tracking-tight">
        {commentCount === 1 ? "1 comment" : `${commentCount} comments`}
      </h2>
      {comments.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No comments yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-line border-y border-line">
          {comments.map((comment) => (
            <li key={comment.id} className="py-4">
              <p className="text-xs text-muted">
                <span className="font-medium text-foreground">{comment.displayName}</span>
                <span aria-hidden="true"> · </span>
                <RelativeTime iso={comment.createdAt} />
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
              {reader?.id === comment.readerId ? (
                <form action={deleteComment} className="mt-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={comment.id} />
                  <button
                    type="submit"
                    className="font-display text-xs font-bold uppercase tracking-wide text-muted hover:text-accent"
                  >
                    Delete
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {reader ? (
        <CommentComposer slug={slug} />
      ) : (
        <p className="mt-6 text-sm text-muted">
          <Link href={signInHref} className="font-medium text-accent">
            Sign in
          </Link>{" "}
          to like or comment.
        </p>
      )}
    </section>
  );
}
