import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { user, userRoleEnum } from "@/db/schema";
import { type KeyedHash, keyedHash } from "./keyed-hash";
import { clearHits, hitsInWindow, type RateRule, recordHit } from "./rate-limit";

// Cookie payload, parsed after the HMAC check so even a validly signed but malformed token is rejected.
const sessionSchema = z.object({
  uid: z.number().int(),
  role: z.enum(userRoleEnum.enumValues),
  sppgId: z.number().int().nullable(),
  ver: z.number().int(),
  exp: z.number(),
});

export type Session = z.infer<typeof sessionSchema>;

export type Role = Session["role"];

export const SESSION_TTL_SECONDS = 4 * 60 * 60;

/** Failed logins allowed per (email, IP) pair and per IP. */
export const LOGIN_LIMITS = {
  emailIp: { limit: 5, windowSeconds: 15 * 60 },
  ip: { limit: 20, windowSeconds: 15 * 60 },
} satisfies Record<string, RateRule>;

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

const KEY_LEN = 64;

export function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(plain, salt, KEY_LEN);

  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");

  if (!saltHex || !hashHex) return false;
  const hash = await scryptAsync(plain, Buffer.from(saltHex, "hex"), KEY_LEN);

  return safeEqual(hash, Buffer.from(hashHex, "hex"));
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function signSession(s: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): Session | null {
  const [payload, sig] = token.split(".");

  if (!payload || !sig) return null;

  if (!safeEqual(Buffer.from(sig), Buffer.from(sign(payload, secret)))) return null;

  try {
    const parsed = sessionSchema.safeParse(JSON.parse(Buffer.from(payload, "base64url").toString()));

    return parsed.success && parsed.data.exp > nowSec ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Re-checks a verified session against the account, so deleting the account, changing its role or kitchen,
 * or bumping its session_version revokes every session it has.
 */
export async function currentSession(db: Db, s: Session): Promise<Session | null> {
  const found = await db.query.user.findFirst({ where: eq(user.id, s.uid) });

  return found && found.role === s.role && found.sppgId === s.sppgId && found.sessionVersion === s.ver ? s : null;
}

// Verified against when the email is unknown, so a miss costs the same scrypt time as a wrong password.
const DUMMY_HASH = `${"0".repeat(32)}:${"0".repeat(KEY_LEN * 2)}`;

export async function authenticate(db: Db, email: string, password: string): Promise<Omit<Session, "exp"> | null> {
  const found = await db.query.user.findFirst({ where: eq(user.email, normalizeEmail(email)) });
  const ok = await verifyPassword(password, found?.passwordHash ?? DUMMY_HASH);

  return found && ok ? { uid: found.id, role: found.role, sppgId: found.sppgId, ver: found.sessionVersion } : null;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export type LoginResult = { ok: true; session: Omit<Session, "exp"> } | { ok: false; reason: "invalid" | "throttled" };

/**
 * Password login with failure throttling. Limits are per (email, IP) and per IP, so a stranger can't lock a
 * (public demo) account for everyone else, and one IP can't spray many accounts. Throttled attempts skip the
 * password check entirely.
 */
export async function login(
  db: Db,
  email: string,
  password: string,
  ipHash: KeyedHash,
  now = new Date(),
): Promise<LoginResult> {
  const emailIpKey = `login:email-ip:${keyedHash(`${normalizeEmail(email)}|${ipHash}`)}` as const;
  const ipKey = `login:ip:${ipHash}` as const;

  const [emailIpHits, ipHits] = await Promise.all([
    hitsInWindow(db, emailIpKey, LOGIN_LIMITS.emailIp, now),
    hitsInWindow(db, ipKey, LOGIN_LIMITS.ip, now),
  ]);

  if (emailIpHits >= LOGIN_LIMITS.emailIp.limit || ipHits >= LOGIN_LIMITS.ip.limit) {
    return { ok: false, reason: "throttled" };
  }

  const session = await authenticate(db, email, password);

  if (!session) {
    await Promise.all([
      recordHit(db, emailIpKey, LOGIN_LIMITS.emailIp, now),
      recordHit(db, ipKey, LOGIN_LIMITS.ip, now),
    ]);

    return { ok: false, reason: "invalid" };
  }

  await clearHits(db, emailIpKey);

  return { ok: true, session };
}
