import { beforeEach, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { todayWIB } from "@/lib/date";
import { menu, sppg, user } from "./schema";
import { assertResetAllowed, resetDb, seed } from "./seed";
import { getTestDb, truncateAll } from "./test-db";

beforeEach(async () => truncateAll(await getTestDb()));

async function userIds() {
  const db = await getTestDb();
  const rows = await db.select({ id: user.id, email: user.email }).from(user).orderBy(user.email);
  return rows;
}

test("reset twice keeps user ids stable", async () => {
  const db = await getTestDb();
  await resetDb(db);
  const first = await userIds();
  await resetDb(db);
  expect(await userIds()).toEqual(first);
  expect(first.length).toBe(3);
});

test("seed refuses a non-empty DB", async () => {
  const db = await getTestDb();
  await seed(db);
  await expect(seed(db)).rejects.toThrow();
});

test("Dahlia has no menu for today, others do", async () => {
  const db = await getTestDb();
  await seed(db);
  const today = todayWIB();
  const rows = await db
    .select({ name: sppg.name })
    .from(menu)
    .innerJoin(sppg, eq(menu.sppgId, sppg.id))
    .where(and(eq(menu.servedOn, today)));
  const names = rows.map((r) => r.name);
  expect(names).toHaveLength(3);
  expect(names.some((n) => n.startsWith("SPPG Dahlia"))).toBe(false);
});

test("assertResetAllowed needs DEMO_MODE and --yes", () => {
  expect(() => assertResetAllowed(false, ["--yes"])).toThrow();
  expect(() => assertResetAllowed(true, [])).toThrow();
  expect(() => assertResetAllowed(true, ["--yes"])).not.toThrow();
});
