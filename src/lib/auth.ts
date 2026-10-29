import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { user } from "@/db/schema";

export type Role = (typeof user.$inferSelect)["role"];
export type Session = { uid: number; role: Role; sppgId: number | null; exp: number };

export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LEN = 64;

function safeEqual(a: Buffer, b: Buffer): boolean {
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
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return typeof s.exp === "number" && s.exp > nowSec ? s : null;
  } catch {
    return null;
  }
}

export async function authenticate(db: Db, email: string, password: string): Promise<Omit<Session, "exp"> | null> {
  const found = await db.query.user.findFirst({ where: eq(user.email, email.trim().toLowerCase()) });
  if (!found || !(await verifyPassword(password, found.passwordHash))) return null;
  return { uid: found.id, role: found.role, sppgId: found.sppgId };
}
