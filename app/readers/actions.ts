"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/src/readers/password";
import { currentReader, endReaderSession, startReaderSession } from "@/src/readers/session";
import {
  addComment,
  createReader,
  deleteOwnComment,
  readerByEmail,
  toggleArticleLike,
} from "@/src/readers/store";
import {
  isStorySlug,
  normalizeComment,
  normalizeDisplayName,
  normalizeEmail,
  normalizePassword,
  safeNextPath,
} from "@/src/readers/validate";

const COMMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUMMY_PASSWORD_HASH = `bm90LWEtcmVhbC1zYWx0.${Buffer.alloc(32, 1).toString("base64url")}`;

export type CommentState = {
  error: string;
  saved: number;
};

function accountPath(kind: "sign-in" | "sign-up", next: string, error: string) {
  const params = new URLSearchParams({ next, error });
  return `/${kind}?${params.toString()}`;
}

function refreshStory(slug: string) {
  revalidatePath("/");
  revalidatePath("/recaps");
  revalidatePath(`/articles/${slug}`);
}

export async function signIn(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  if (!process.env.DATABASE_URL) redirect(accountPath("sign-in", next, "unavailable"));
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !normalizePassword(password)) redirect(accountPath("sign-in", next, "credentials"));
  const reader = await readerByEmail(email);
  const matches = await verifyPassword(password, reader?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!reader || !matches) redirect(accountPath("sign-in", next, "credentials"));
  await startReaderSession(reader.id);
  redirect(next);
}

export async function signUp(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  if (!process.env.DATABASE_URL) redirect(accountPath("sign-up", next, "unavailable"));
  const email = String(formData.get("email") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!normalizeEmail(email) || !normalizeDisplayName(displayName) || !normalizePassword(password)) {
    redirect(accountPath("sign-up", next, "fields"));
  }
  const created = await createReader({ email, displayName, password });
  if (!created.ok) redirect(accountPath("sign-up", next, created.reason));
  await startReaderSession(created.id);
  redirect(next);
}

export async function signOut() {
  await endReaderSession();
  redirect("/");
}

export async function toggleLike(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  if (!isStorySlug(slug)) return;
  const reader = await currentReader();
  if (!reader) redirect(`/sign-in?next=${encodeURIComponent(`/articles/${slug}`)}`);
  await toggleArticleLike(reader.id, slug);
  refreshStory(slug);
}

export async function postComment(
  slug: string,
  prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  if (!isStorySlug(slug)) return { error: "That story is missing.", saved: prev.saved };
  const reader = await currentReader();
  if (!reader) return { error: "Sign in to comment.", saved: prev.saved };
  const body = normalizeComment(String(formData.get("body") ?? ""));
  if (!body) return { error: "Comment must be 1–500 characters.", saved: prev.saved };
  await addComment(reader.id, slug, body);
  refreshStory(slug);
  return { error: "", saved: prev.saved + 1 };
}

export async function deleteComment(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!isStorySlug(slug) || !COMMENT_ID.test(id)) return;
  const reader = await currentReader();
  if (!reader) redirect(`/sign-in?next=${encodeURIComponent(`/articles/${slug}`)}`);
  await deleteOwnComment(reader.id, id);
  refreshStory(slug);
}
