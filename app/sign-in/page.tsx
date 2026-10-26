import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PendingButton } from "@/components/admin/PendingButton";
import { signIn } from "@/app/readers/actions";
import { pageWidth } from "@/lib/labels";
import { currentReader } from "@/src/readers/session";
import { safeNextPath } from "@/src/readers/validate";

export const metadata = {
  title: "Sign in",
};

type Search = {
  error?: string | string[];
  next?: string | string[];
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function message(error: string | undefined) {
  if (error === "credentials") return "Email or password is wrong.";
  if (error === "unavailable") return "Accounts are unavailable right now.";
  return null;
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense
      fallback={
        <main className={`${pageWidth} py-8`}>
          <p className="text-muted">Opening sign in…</p>
        </main>
      }
    >
      <SignInForm searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInForm({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const next = safeNextPath(one(params.next));
  if (await currentReader()) redirect(next);
  const error = message(one(params.error));
  const signUpHref = next === "/" ? "/sign-up" : `/sign-up?next=${encodeURIComponent(next)}`;

  return (
    <main className={`${pageWidth} py-8`}>
      <h1 className="font-display text-4xl font-extrabold uppercase tracking-wide">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Sign in to like and comment.</p>
      <div className="mt-6 max-w-sm border border-line bg-surface p-5">
        {error ? (
          <p role="status" className="mb-4 text-sm text-down">
            {error}
          </p>
        ) : null}
        <form action={signIn} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
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
              autoComplete="current-password"
              minLength={8}
              className="border border-line bg-background px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <PendingButton idle="Sign in" pending="Checking…" />
        </form>
        <p className="mt-4 text-sm text-muted">
          New here?{" "}
          <Link href={signUpHref} className="font-medium text-accent">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
