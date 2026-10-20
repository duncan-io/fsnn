import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { io } from "next/cache";
import { cookies } from "next/headers";

const SESSION_COOKIE = "fsnn_admin";
const STATE_COOKIE = "fsnn_yahoo_oauth_state";
const SESSION_SECONDS = 60 * 60 * 12;
const STATE_SECONDS = 10 * 60;

export function adminPassword() {
  const value = process.env.ADMIN_PASSWORD?.trim();
  return value ? value : null;
}

export function passwordsMatch(input: string, password: string) {
  const left = createHmac("sha256", "fsnn-admin-password").update(input).digest();
  const right = createHmac("sha256", "fsnn-admin-password").update(password).digest();
  return timingSafeEqual(left, right);
}

function sign(payload: string, password: string) {
  return createHmac("sha256", password).update(payload).digest("base64url");
}

export function createSessionValue(password: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = String(exp);
  return `${payload}.${sign(payload, password)}`;
}

export function sessionIsValid(value: string | undefined, password: string | null, now: number) {
  if (!password || !value) return false;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const exp = Number(payload);
  if (!Number.isInteger(exp) || exp * 1000 <= now) return false;
  const expected = sign(payload, password);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function sameSecret(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export async function isAdminSession() {
  const password = adminPassword();
  if (!password) return false;
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  await io();
  return sessionIsValid(value, password, Date.now());
}

export async function setAdminSession() {
  const password = adminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not set.");
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionValue(password), cookieOptions(SESSION_SECONDS));
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function setOAuthState() {
  const state = randomBytes(16).toString("hex");
  const store = await cookies();
  store.set(STATE_COOKIE, state, cookieOptions(STATE_SECONDS));
  return state;
}

export async function takeOAuthState() {
  const store = await cookies();
  const value = store.get(STATE_COOKIE)?.value ?? "";
  store.delete(STATE_COOKIE);
  return value;
}
