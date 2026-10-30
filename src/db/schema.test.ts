import { beforeEach, expect, test } from "bun:test";
import { one } from "./index";
import { episode, menu, report, response, school, sppg, user } from "./schema";
import { getTestDb, truncateAll } from "./test-db";

beforeEach(async () => truncateAll(await getTestDb()));

async function insertSppg() {
  const db = await getTestDb();

  return one(await db.insert(sppg).values({ name: "SPPG Uji", district: "Kec. Uji" }).returning());
}

test("sppg_manager without sppg_id is rejected", async () => {
  const db = await getTestDb();
  await expect(
    db.insert(user).values({ email: "m@x.id", passwordHash: "h", role: "sppg_manager", sppgId: null }).execute(),
  ).rejects.toThrow();
});

test("moderator without sppg_id is accepted", async () => {
  const db = await getTestDb();

  const rows = await db.insert(user).values({ email: "mod@x.id", passwordHash: "h", role: "moderator" }).returning();

  expect(rows).toHaveLength(1);
});

test("response with neither report_id nor episode_id is rejected", async () => {
  const db = await getTestDb();
  await expect(db.insert(response).values({ body: "x", authorKind: "moderator" }).execute()).rejects.toThrow();
});

test("response with both report_id and episode_id is rejected", async () => {
  const db = await getTestDb();
  const s = await insertSppg();
  const sc = one(await db.insert(school).values({ name: "SD", code: "SD1", lat: 0, lng: 0, sppgId: s.id }).returning());

  const r = one(
    await db
      .insert(report)
      .values({
        schoolId: sc.id,
        reporterRole: "student",
        kind: "experience",
        consumedOn: "2026-10-29",
        locationCheck: "unavailable",
        tokenHash: "t",
        deviceHash: "d",
        ipHash: "i",
      })
      .returning(),
  );

  const e = one(await db.insert(episode).values({ sppgId: s.id, rule: "auto_multi_school" }).returning());
  await expect(
    db.insert(response).values({ reportId: r.id, episodeId: e.id, body: "x", authorKind: "moderator" }).execute(),
  ).rejects.toThrow();
});

test("menu is unique per sppg per served_on", async () => {
  const db = await getTestDb();
  const s = await insertSppg();
  const row = { sppgId: s.id, servedOn: "2026-10-29", name: "Nasi ayam", composition: "Nasi, ayam" };
  await db.insert(menu).values(row);
  await expect(db.insert(menu).values(row).execute()).rejects.toThrow();
});
