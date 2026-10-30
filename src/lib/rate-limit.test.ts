import { beforeEach, expect, test } from "bun:test";
import { getTestDb } from "@/db/test-db";
import { rateLimit } from "@/db/schema";
import { keyedHash } from "./keyed-hash";
import { hitsInWindow, pruneRateLimits, recordHit } from "./rate-limit";

const rule = { limit: 3, windowSeconds: 60 };
const key = `login:ip:${keyedHash("203.0.113.7")}` as const;
const t0 = new Date("2026-10-30T10:00:00Z");
const plus = (s: number) => new Date(t0.getTime() + s * 1000);

beforeEach(async () => {
  await (await getTestDb()).delete(rateLimit);
});

test("counts hits inside one window and starts over in the next", async () => {
  const db = await getTestDb();

  expect(await recordHit(db, key, rule, t0)).toBe(1);
  expect(await recordHit(db, key, rule, plus(59))).toBe(2);
  expect(await hitsInWindow(db, key, rule, plus(30))).toBe(2);
  expect(await hitsInWindow(db, key, rule, plus(60))).toBe(0);
  expect(await recordHit(db, key, rule, plus(60))).toBe(1);
});

test("concurrent hits are all counted (atomic upsert)", async () => {
  const db = await getTestDb();

  await Promise.all(Array.from({ length: 10 }, () => recordHit(db, key, rule, t0)));

  expect(await hitsInWindow(db, key, rule, t0)).toBe(10);
});

test("prune deletes windows older than 24h only", async () => {
  const db = await getTestDb();
  await recordHit(db, key, rule, t0);
  await recordHit(db, key, rule, plus(23 * 3600));

  expect(await pruneRateLimits(db, plus(24 * 3600 + 1))).toBe(1);
  expect(await hitsInWindow(db, key, rule, plus(23 * 3600))).toBe(1);
});
