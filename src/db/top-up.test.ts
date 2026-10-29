import { beforeEach, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { report, school } from "./schema";
import { resetDb } from "./seed";
import { getTestDb } from "./test-db";
import { topUp } from "./top-up";

beforeEach(async () => resetDb(await getTestDb()));

const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000);

test("top-up inserts nothing when seed already covers today", async () => {
  expect((await topUp(await getTestDb())).inserted).toBe(0);
});

test("top-up inserts once per WIB day", async () => {
  const db = await getTestDb();
  const at = tomorrow();
  expect((await topUp(db, at)).inserted).toBeGreaterThan(0);
  expect((await topUp(db, at)).inserted).toBe(0);
});

test("top-up never deletes judge reports", async () => {
  const db = await getTestDb();
  const [sc] = await db.select().from(school).limit(1);
  const [judge] = await db
    .insert(report)
    .values({
      schoolId: sc.id,
      reporterRole: "teacher",
      kind: "experience",
      consumedOn: "2026-10-29",
      locationCheck: "inside",
      tokenHash: "judge-token",
      deviceHash: "judge-device",
      ipHash: "judge-ip",
    })
    .returning();
  await topUp(db, tomorrow());
  expect(await db.select().from(report).where(eq(report.id, judge.id))).toHaveLength(1);
});

test("route rejects missing or wrong bearer", async () => {
  const { GET } = await import("@/app/api/cron/top-up/route");
  expect((await GET(new Request("http://x/api/cron/top-up"))).status).toBe(401);
  expect((await GET(new Request("http://x", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
});

test("route runs top-up with the right bearer", async () => {
  const { GET } = await import("@/app/api/cron/top-up/route");
  const res = await GET(new Request("http://x", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ inserted: 0 });
});

test("the cron fires after lunch starts in WIB, so top-up reports land in lunch hours", async () => {
  const { crons } = (await Bun.file("vercel.json").json()) as { crons: { path: string; schedule: string }[] };
  const [minute, hourUtc] = crons.find((c) => c.path === "/api/cron/top-up")!.schedule.split(" ").map(Number);
  const wibHour = (hourUtc + 7) % 24;
  expect(minute).toBe(0);
  expect(wibHour).toBeGreaterThanOrEqual(11); // lunch window starts 10:00 WIB; ≥1h of spread
  expect(wibHour).toBeLessThan(16);
});
