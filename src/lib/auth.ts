import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { user, userRoleEnum } from "@/db/schema";

// Cookie payload, parsed after the HMAC check so even a validly signed but malformed token is rejected.
const sessionSchema = z.object({
  uid: z.number().int(),
  role: z.enum(userRoleEnum.enumValues),
  sppgId: z.number().int().nullable(),
  exp: z.number(),
});

export type Session = z.infer<typeof sessionSchema>;

export type Role = Session["role"];

export const SESSION_TTL_SECONDS = 8 * 60 * 60;

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

/** Re-checks a verified session against the account, so deleting or changing an account revokes its sessions. */
export async function currentSession(db: Db, s: Session): Promise<Session | null> {
  const found = await db.query.user.findFirst({ where: eq(user.id, s.uid) });

  return found && found.role === s.role && found.sppgId === s.sppgId ? s : null;
}

export async function authenticate(db: Db, email: string, password: string): Promise<Omit<Session, "exp"> | null> {
  const found = await db.query.user.findFirst({ where: eq(user.email, email.trim().toLowerCase()) });

  if (!found || !(await verifyPassword(password, found.passwordHash))) return null;

  return { uid: found.id, role: found.role, sppgId: found.sppgId };
}
