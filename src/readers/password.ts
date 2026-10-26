import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 32;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}.${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const dot = stored.indexOf(".");
  if (dot <= 0) return false;
  const salt = stored.slice(0, dot);
  const expected = Buffer.from(stored.slice(dot + 1), "base64url");
  if (expected.length === 0) return false;
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
