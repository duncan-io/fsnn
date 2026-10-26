import { randomBytes } from "node:crypto";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/src/db/client";
import { readerSessions, readers } from "@/src/db/schema";
import { isUnreachableDatabase } from "@/src/readers/errors";

const COOKIE = "fsnn_reader";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type ReaderSession = {
  id: string;
  email: string;
  displayName: string;
};

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_SECONDS,
  };
}

export async function currentReader(): Promise<ReaderSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  if (!process.env.DATABASE_URL) return null;
  await io();
  try {
    const [row] = await getDb()
      .select({
        id: readers.id,
        email: readers.email,
        displayName: readers.displayName,
        expiresAt: readerSessions.expiresAt,
      })
      .from(readerSessions)
      .innerJoin(readers, eq(readerSessions.readerId, readers.id))
      .where(eq(readerSessions.token, token))
      .limit(1);
    if (!row || row.expiresAt.getTime() <= Date.now()) return null;
    return { id: row.id, email: row.email, displayName: row.displayName };
  } catch (error) {
    if (isUnreachableDatabase(error)) return null;
    throw error;
  }
}

export async function startReaderSession(readerId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  await getDb().insert(readerSessions).values({ token, readerId, expiresAt });
  const store = await cookies();
  store.set(COOKIE, token, cookieOptions());
}

export async function endReaderSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token && process.env.DATABASE_URL) {
    await getDb().delete(readerSessions).where(eq(readerSessions.token, token));
  }
  store.delete(COOKIE);
}
