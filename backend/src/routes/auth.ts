import { Router, type CookieOptions } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import {
  assertNotLockedOut,
  clearFailures,
  createSessionToken,
  readCookie,
  recordFailure,
  SESSION_COOKIE,
  SESSION_HOURS,
  verifyPassword,
  verifySessionToken,
} from "../lib/auth.js";

// Sign in and out. Mounted at /api/auth, before the sign-in check.
export const authRouter = Router();

const signIn = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});

// httpOnly: page scripts cannot read it. sameSite lax: the frontend (port 3000)
// and API (port 4000) are on the same host, so the browser still sends it.
const cookieOptions: CookieOptions = { httpOnly: true, sameSite: "lax", path: "/" };

/** POST /api/auth/login */
authRouter.post("/login", async (req, res) => {
  const ip = req.ip ?? "unknown";
  assertNotLockedOut(ip);
  const dto = signIn.parse(req.body);

  const user = await prisma.user.findUnique({ where: { username: dto.username } });
  if (!user && (await prisma.user.count()) === 0) {
    throw new HttpError(503, "No admin password is set yet. Run `npm run set-password --prefix backend` on the clinic computer.");
  }

  // Same message whether the username or the password was wrong, so the form
  // does not confirm which usernames exist.
  if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
    recordFailure(ip);
    throw new HttpError(401, "Wrong username or password.");
  }

  clearFailures(ip);
  res.cookie(SESSION_COOKIE, createSessionToken(user), { ...cookieOptions, maxAge: SESSION_HOURS * 60 * 60 * 1000 });
  res.json({ data: { username: user.username } });
});

/** POST /api/auth/logout */
authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

/** GET /api/auth/me — who is signed in, or 401. */
authRouter.get("/me", async (req, res) => {
  const username = await verifySessionToken(readCookie(req, SESSION_COOKIE));
  if (!username) throw new HttpError(401, "Please sign in.");
  res.json({ data: { username } });
});
