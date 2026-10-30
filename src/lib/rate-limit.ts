import { and, eq, lt, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { rateLimit } from "@/db/schema";
import type { KeyedHash } from "./keyed-hash";

/** A fixed window: at most `limit` hits per `windowSeconds`. */
export type RateRule = { limit: number; windowSeconds: number };

// Namespaced keys. The part after the prefix is always a keyedHash, never a raw IP or email.
export type RateKey = `login:email-ip:${KeyedHash}` | `login:ip:${KeyedHash}`;

const windowStart = (rule: RateRule, now: Date) => {
  const ms = rule.windowSeconds * 1000;

  return new Date(Math.floor(now.getTime() / ms) * ms);
};

/** Hits recorded for `key` in the current window. */
export async function hitsInWindow(db: DbOrTx, key: RateKey, rule: RateRule, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ count: rateLimit.count })
    .from(rateLimit)
    .where(and(eq(rateLimit.key, key), eq(rateLimit.windowStart, windowStart(rule, now))));

  return row?.count ?? 0;
}

/** Records one hit for `key` in the current window (one atomic upsert) and returns the new count. */
export async function recordHit(db: DbOrTx, key: RateKey, rule: RateRule, now = new Date()): Promise<number> {
  const [row] = await db
    .insert(rateLimit)
    .values({ key, windowStart: windowStart(rule, now), count: 1 })
    .onConflictDoUpdate({ target: [rateLimit.key, rateLimit.windowStart], set: { count: sql`${rateLimit.count} + 1` } })
    .returning({ count: rateLimit.count });

  return row?.count ?? 1;
}

/** Forgets every window for `key`, e.g. after a successful login. */
export async function clearHits(db: DbOrTx, key: RateKey): Promise<void> {
  await db.delete(rateLimit).where(eq(rateLimit.key, key));
}

/** Deletes windows older than 24 hours. Run by the daily cron. */
export async function pruneRateLimits(db: DbOrTx, now = new Date()): Promise<number> {
  const rows = await db
    .delete(rateLimit)
    .where(lt(rateLimit.windowStart, new Date(now.getTime() - 24 * 3_600_000)))
    .returning({ key: rateLimit.key });

  return rows.length;
}
