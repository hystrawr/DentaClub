import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Request, RequestHandler } from "express";
import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";

// Sign-in: password hashing and the session cookie.
//
// The session is a signed cookie, not a database row: `<payload>.<signature>`,
// where the payload names the user and when it expires. The signature covers
// the user's password hash as well, so changing the password signs out every
// device that was signed in with the old one.

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "dentaclub_session";
/** How long a sign-in lasts: a working day. */
export const SESSION_HOURS = 12;

/* ── Passwords ──────────────────────────────────────────────────────────── */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/* ── Session tokens ─────────────────────────────────────────────────────── */

/** APP_KEY from .env, as raw bytes (`base64:…` or bare base64). */
function secret(): Buffer {
  const raw = process.env.APP_KEY ?? "";
  const key = Buffer.from(raw.startsWith("base64:") ? raw.slice(7) : raw, "base64");
  if (key.length < 32) throw new Error("APP_KEY in backend/.env must be at least 32 random bytes (see README).");
  return key;
}

const sign = (payload: string, passwordHash: string) =>
  createHmac("sha256", secret()).update(payload).update("\0").update(passwordHash).digest("base64url");

export function createSessionToken(user: { username: string; passwordHash: string }): string {
  const payload = Buffer.from(
    JSON.stringify({ u: user.username, exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload, user.passwordHash)}`;
}

/** The signed-in username, or null for a missing, expired, forged or outdated token. */
export async function verifySessionToken(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let claims: { u?: unknown; exp?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (typeof claims.u !== "string" || typeof claims.exp !== "number" || claims.exp < Date.now()) return null;

  const user = await prisma.user.findUnique({ where: { username: claims.u } });
  if (!user) return null;

  const expected = Buffer.from(sign(payload, user.passwordHash));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? user.username : null;
}

/** One cookie from the Cookie header (no cookie-parser dependency for one value). */
export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** Refuse every request that is not signed in. */
export const requireSignIn: RequestHandler = async (req, res, next) => {
  const username = await verifySessionToken(readCookie(req, SESSION_COOKIE));
  if (!username) throw new HttpError(401, "Please sign in.");
  res.locals.username = username;
  next();
};

/* ── Too many wrong passwords ───────────────────────────────────────────── */

const MAX_FAILURES = 5;
const LOCKOUT_MS = 60 * 1000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

/** Throws 429 while this address is locked out after repeated wrong passwords. */
export function assertNotLockedOut(ip: string) {
  const entry = failures.get(ip);
  if (entry && entry.lockedUntil > Date.now()) {
    const seconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    throw new HttpError(429, `Too many wrong passwords. Try again in ${seconds} seconds.`);
  }
}

export function recordFailure(ip: string) {
  const entry = failures.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) {
    entry.count = 0;
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  failures.set(ip, entry);
}

export const clearFailures = (ip: string) => failures.delete(ip);
