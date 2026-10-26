import Link from "next/link";
import { signOut } from "@/app/readers/actions";
import { currentReader } from "@/src/readers/session";

export async function ReaderMenu() {
  const reader = await currentReader();

  if (!reader) {
    return (
      <Link
        href="/sign-in"
        className="font-display text-xs font-bold uppercase tracking-wide text-foreground hover:text-accent"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[9rem] truncate font-display text-xs font-bold uppercase tracking-wide">
        {reader.displayName}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="font-display text-xs font-bold uppercase tracking-wide text-muted hover:text-accent"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
