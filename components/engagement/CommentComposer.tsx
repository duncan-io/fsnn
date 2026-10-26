"use client";

import { useActionState } from "react";
import { PendingButton } from "@/components/admin/PendingButton";
import { postComment, type CommentState } from "@/app/readers/actions";

const initial: CommentState = { error: "", saved: 0 };

export function CommentComposer({ slug }: { slug: string }) {
  const [state, action] = useActionState(postComment.bind(null, slug), initial);

  return (
    <form action={action} key={state.saved} className="mt-4 flex flex-col gap-3">
      {state.error ? (
        <p role="status" className="text-sm text-down">
          {state.error}
        </p>
      ) : null}
      <label className="flex flex-col gap-2 text-sm text-muted">
        Comment
        <textarea
          name="body"
          required
          maxLength={500}
          rows={4}
          className="border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
        />
      </label>
      <div>
        <PendingButton idle="Post comment" pending="Posting…" />
      </div>
    </form>
  );
}
