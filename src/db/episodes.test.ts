import { beforeEach, expect, test } from "bun:test";
import { desc, eq, isNull } from "drizzle-orm";
import { addDays, todayWIB } from "@/lib/date";
import { getBoard, getRapor, getSchoolPage } from "./board";
import { closeEpisode, lockKitchen, syncEpisode } from "./episodes";
import { createDb, type Db, one } from "./index";
import { auditLog, episode, type NewReport, report, response, school, sppg, user } from "./schema";
import { getTestDb, truncateAll } from "./test-db";

const now = new Date("2026-11-09T13:00:00+07:00");
const later = new Date(now.getTime() + 25 * 3_600_000);

beforeEach(async () => truncateAll(await getTestDb()));

async function setup() {
  const db = await getTestDb();
  const kitchen = one(await db.insert(sppg).values({ name: "Dapur", district: "Kecamatan" }).returning());

  const [first, second] = await db
    .insert(school)
    .values(["a", "b"].map((code) => ({ sppgId: kitchen.id, code, name: `SD ${code}`, lat: 0, lng: 0 })))
    .returning();

  if (!first || !second) throw new Error("Expected two schools");
  const a = first;
  const b = second;

  function send(schoolId: number, key: string, overrides: Partial<NewReport> = {}, client = db) {
    return client.transaction(async (tx) => {
      await lockKitchen(tx, kitchen.id);

      const submitted = one(
        await tx
          .insert(report)
          .values({
            schoolId,
            reporterRole: "parent",
            kind: "health",
            consumedOn: todayWIB(now),
            receivedAt: now,
            subject: "self",
            symptoms: ["nausea"],
            locationCheck: "inside",
            tokenHash: key,
            deviceHash: key,
            ipHash: "test",
            ...overrides,
          })
          .returning({ id: report.id }),
      );

      await syncEpisode(tx, kitchen.id, now);

      return submitted.id;
    });
  }

  async function open() {
    const firstReportId = await send(a.id, "one");
    await send(a.id, "two");
    const third = await send(b.id, "three");

    return { id: one(await db.select().from(episode)).id, firstReportId, third };
  }

  async function change(id: number, updates: Partial<NewReport>) {
    await db.transaction(async (tx) => {
      await lockKitchen(tx, kitchen.id);
      await tx.update(report).set(updates).where(eq(report.id, id));
      await syncEpisode(tx, kitchen.id, now);
    });
  }

  return { db, kitchen, a, b, send, open, change };
}

async function withAnotherConnection<T>(run: (client: Db) => Promise<T>) {
  const url = process.env.TEST_DATABASE_URL;

  if (!url) throw new Error("TEST_DATABASE_URL is required");
  const client = createDb(url);

  try {
    return await run(client);
  } finally {
    await client.$client.end();
  }
}

async function latestCloseAudit(db: Db) {
  return one(
    await db.select().from(auditLog).where(eq(auditLog.action, "episode.closed")).orderBy(desc(auditLog.id)).limit(1),
  );
}

test("concurrent complaints open one episode and attach only qualifying health reports", async () => {
  const { db, kitchen, a, b, send } = await setup();
  await send(a.id, "one");
  await send(b.id, "old", { consumedOn: addDays(todayWIB(now), -2) });
  expect(await db.select().from(episode)).toHaveLength(0);

  await withAnotherConnection((other) => Promise.all([send(a.id, "two"), send(b.id, "three", {}, other)]));
  const active = one(await db.select().from(episode));
  expect(active.rule).toBe("auto_multi_school");
  expect(await db.select().from(report).where(eq(report.episodeId, active.id))).toHaveLength(3);

  await send(a.id, "four");
  await send(a.id, "survey", { kind: "experience", rating: 4, symptoms: [], subject: null });
  expect(await db.select().from(episode)).toHaveLength(1);
  expect(await db.select().from(report).where(eq(report.episodeId, active.id))).toHaveLength(4);
  expect(await db.select().from(report).where(isNull(report.episodeId))).toHaveLength(2);
  expect((await getRapor(db, kitchen.id, later))?.signal.reason).toContain("sejak terdeteksi");
  expect((await getSchoolPage(db, a.code, later))?.signal.status).toBe("priority");
});

test("manual close requires a note, audits the actor and prevents old evidence from reopening", async () => {
  const { db, kitchen, a, b, open, send } = await setup();
  const { id } = await open();

  const moderator = one(
    await db.insert(user).values({ email: "mod@test", passwordHash: "test", role: "moderator" }).returning(),
  );

  await expect(db.transaction((tx) => closeEpisode(tx, id, "  ", moderator.id, now))).rejects.toThrow("Catatan");
  await db
    .insert(response)
    .values({ episodeId: id, authorKind: "sppg", body: "Sudah ditindaklanjuti", createdAt: now });
  await db.transaction((tx) => closeEpisode(tx, id, "  Sudah ditangani  ", moderator.id, now));
  await expect(db.transaction((tx) => closeEpisode(tx, id, "Kedua", moderator.id, now))).rejects.toThrow(
    "sudah ditutup",
  );
  const rapor = await getRapor(db, kitchen.id, now);
  expect(rapor?.signal.status).toBe("attention");
  expect(rapor?.episodeHistory[0]).toMatchObject({ closedNote: "Sudah ditangani", firstResponseAt: now });
  const event = await latestCloseAudit(db);
  expect(event.actorUserId).toBe(moderator.id);
  expect(event.after).toMatchObject({ closedNote: "Sudah ditangani" });

  await send(a.id, "new-one");
  await send(b.id, "new-two");
  expect(await db.select().from(episode).where(isNull(episode.closedAt))).toHaveLength(0);
  await send(b.id, "new-three");
  expect(await db.select().from(episode).where(isNull(episode.closedAt))).toHaveLength(1);
});

test("teacher group opens after review and rejection closes it with a system audit", async () => {
  const { db, kitchen, a, send, change } = await setup();
  const id = await send(a.id, "group", { reporterRole: "teacher", subject: "group", affectedCount: 5 });
  expect((await getRapor(db, kitchen.id, now))?.signal.status).toBe("attention");
  await change(id, { status: "reviewed" });
  expect((await getRapor(db, kitchen.id, now))?.openEpisode?.rule).toBe("teacher_group_reviewed");
  await change(id, { status: "rejected", rejectReason: "Data tidak cocok" });

  const closed = one(await db.select().from(episode));
  expect(closed).toMatchObject({
    closedByUserId: null,
    closedNote: "Ditutup otomatis: laporan ditolak — Data tidak cocok",
  });
  expect((await getRapor(db, kitchen.id, now))?.signal.status).toBe("no_data");
  const event = await latestCloseAudit(db);
  expect(event.actorUserId).toBeNull();
  expect(event.entityId).toBe(closed.id);
});

test("concurrent submit and reject serialize on the kitchen lock", async () => {
  const { db, b, send, open, change } = await setup();
  const { id, third } = await open();

  const [fourth] = await withAnotherConnection((other) =>
    Promise.all([send(b.id, "fourth", {}, other), change(third, { status: "rejected", rejectReason: "Tidak cocok" })]),
  );

  const result = one(await db.select().from(episode));
  const inserted = one(await db.select().from(report).where(eq(report.id, fourth)));
  expect(inserted.episodeId).toBe(result.closedAt ? null : id);
});

test("review and overdue labels follow the attached reports and the kitchen's episode reply", async () => {
  const { db, kitchen, a, send, open, change } = await setup();
  const { id, firstReportId, third } = await open();
  const entry = async () => one(await getBoard(db, later));
  const atDeadline = new Date(now.getTime() + 24 * 3_600_000);
  expect(one(await getBoard(db, atDeadline)).overdueHours).toBeNull();
  expect((await entry()).overdueHours).toBe(25);
  expect((await entry()).signal.label).toContain("belum ditinjau");

  await db.transaction(async (tx) => {
    await lockKitchen(tx, kitchen.id);
    await tx.update(report).set({ status: "reviewed" }).where(eq(report.episodeId, id));
    await syncEpisode(tx, kitchen.id, now);
  });
  expect((await entry()).signal.label).toBe("Ditinjau moderator");
  await send(a.id, "fourth");
  expect((await entry()).signal.label).toContain("belum ditinjau");

  await db.insert(response).values({ reportId: third, authorKind: "sppg", body: "Per laporan", createdAt: later });
  expect((await entry()).overdueHours).toBe(25);
  await db.insert(response).values({ episodeId: id, authorKind: "sppg", body: "Per episode", createdAt: later });
  expect((await entry()).overdueHours).toBeNull();
  expect((await getRapor(db, kitchen.id, later))?.openEpisode?.replies.map((reply) => reply.body)).toEqual([
    "Per episode",
  ]);

  await change(third, { duplicateOf: firstReportId });
  expect(one(await db.select().from(episode)).closedNote).toBe("Ditutup otomatis: laporan digabung sebagai duplikat");
});

test("Beranda sorts overdue episodes before older answered ones, then by first detection", async () => {
  const { db, open } = await setup();
  await open();

  const [answered, recent, quiet] = await db
    .insert(sppg)
    .values(["A Sudah menjawab", "B Baru", "C Sepi"].map((name) => ({ name, district: "Kecamatan" })))
    .returning();

  if (!answered || !recent || !quiet) throw new Error("Expected three additional kitchens");

  const [old] = await db
    .insert(episode)
    .values([
      { sppgId: answered.id, rule: "auto_multi_school", firstDetectedAt: new Date(now.getTime() - 3_600_000) },
      { sppgId: recent.id, rule: "auto_multi_school", firstDetectedAt: later },
    ])
    .returning();

  if (!old) throw new Error("Expected an older episode");
  await db.insert(response).values({ episodeId: old.id, authorKind: "sppg", body: "Sudah dijawab", createdAt: now });

  expect((await getBoard(db, later)).map((k) => k.name)).toEqual(["Dapur", answered.name, recent.name, quiet.name]);
});
