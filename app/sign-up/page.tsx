import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PendingButton } from "@/components/admin/PendingButton";
import { signUp } from "@/app/readers/actions";
import { pageWidth } from "@/lib/labels";
import { currentReader } from "@/src/readers/session";
import { safeNextPath } from "@/src/readers/validate";

export const metadata = {
  title: "Create account",
};

type Search = {
  error?: string | string[];
  next?: string | string[];
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function message(error: string | undefined) {
  if (error === "fields") {
    return "Use a display name (2–24 characters), a valid email, and a password of at least 8 characters.";
  }
  if (error === "email") return "That email already has an account.";
  if (error === "name") return "That display name is taken.";
  if (error === "unavailable") return "Accounts are unavailable right now.";
  return null;
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense
      fallback={
        <main className={`${pageWidth} py-8`}>
          <p className="text-muted">Opening account setup…</p>
        </main>
      }
    >
      <SignUpForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUpForm({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const next = safeNextPath(one(params.next));
  if (await currentReader()) redirect(next);
  const error = message(one(params.error));
  const signInHref = next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;

  return (
    <main className={`${pageWidth} py-8`}>
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">Create account</h1>
      <p className="mt-2 text-sm text-muted">A display name, email, and password. That is the whole account.</p>
      <div className="mt-6 max-w-sm border border-line bg-surface p-5">
        {error ? (
          <p role="status" className="mb-4 text-sm text-down">
            {error}
          </p>
        ) : null}
        <form action={signUp} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-2 text-sm text-muted">
            Display name
            <input
              type="text"
              name="displayName"
              required
              minLength={2}
              maxLength={24}
              autoComplete="nickname"
              className="border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-muted">
            Email
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-muted">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <PendingButton idle="Create account" pending="Creating…" />
        </form>
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <Link href={signInHref} className="font-medium text-accent">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
