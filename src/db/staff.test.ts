import { beforeEach, expect, test } from "bun:test";
import { desc, eq } from "drizzle-orm";
import { addDays, todayWIB } from "@/lib/date";
import { getRapor } from "./board";
import { getOpenEpisodes } from "./episodes";
import { one } from "./index";
import { auditLog, episode, menu, type NewReport, report, response, school, sppg, user } from "./schema";
import { resetDb } from "./seed";
import { getFollowUp, getManagerDashboard, getReviewQueue, getSurges } from "./staff";
import { moderateEpisode, moderateReport, replyAsManager, updateTodayMenu } from "./staff-actions";
import { getTestDb, truncateAll } from "./test-db";

beforeEach(async () => truncateAll(await getTestDb()));

async function fixture() {
  const db = await getTestDb();
  const now = new Date();
  const day = todayWIB(now);
  const kitchen = one(await db.insert(sppg).values({ name: "Dapur A", district: "Kecamatan" }).returning());
  const other = one(await db.insert(sppg).values({ name: "Dapur B", district: "Kecamatan" }).returning());

  const primary = one(
    await db
      .insert(school)
      .values({
        name: "SD A",
        code: "sd-a",
        lat: 0,
        lng: 0,
        sppgId: kitchen.id,
      })
      .returning(),
  );

  const secondary = one(
    await db
      .insert(school)
      .values({
        name: "SD B",
        code: "sd-b",
        lat: 0,
        lng: 0,
        sppgId: other.id,
      })
      .returning(),
  );

  const moderator = one(
    await db
      .insert(user)
      .values({
        email: "moderator@example.test",
        passwordHash: "unused",
        role: "moderator",
      })
      .returning({ uid: user.id }),
  );

  const manager = one(
    await db
      .insert(user)
      .values({
        email: "manager@example.test",
        passwordHash: "unused",
        role: "sppg_manager",
        sppgId: kitchen.id,
      })
      .returning({ uid: user.id, sppgId: user.sppgId }),
  );

  async function submit(key: string, fields: Partial<NewReport> = {}) {
    return one(
      await db
        .insert(report)
        .values({
          schoolId: primary.id,
          reporterRole: "parent",
          kind: "health",
          consumedOn: day,
          receivedAt: now,
          symptoms: ["nausea"],
          subject: "self",
          locationCheck: "inside",
          tokenHash: key,
          deviceHash: key,
          ipHash: key,
          ...fields,
        })
        .returning(),
    ).id;
  }

  const statusOf = async (id: number) => one(await db.select().from(report).where(eq(report.id, id))).status;
  const latestAudit = async () => one(await db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(1));

  return { db, now, day, kitchen, other, primary, secondary, moderator, manager, submit, statusOf, latestAudit };
}

test("review opens the teacher episode, refuses stale status, and supports forwarding and close", async () => {
  const { db, moderator, manager, submit, statusOf, latestAudit } = await fixture();
  const id = await submit("teacher", { reporterRole: "teacher", subject: "group", affectedCount: 5 });

  await expect(moderateReport(db, moderator, id, "received", { kind: "finish" })).rejects.toThrow("belum bisa");
  await expect(moderateReport(db, moderator, id, "received", { kind: "reject", reason: " " })).rejects.toThrow(
    "Isi teks",
  );
  await moderateReport(db, moderator, id, "received", { kind: "review" });
  expect(await statusOf(id)).toBe("reviewed");
  expect(await latestAudit()).toMatchObject({
    action: "report.status_changed",
    actorUserId: moderator.uid,
    entityId: id,
  });
  await expect(
    moderateReport(db, moderator, id, "received", { kind: "reject", reason: "Laporan salah" }),
  ).rejects.toThrow("muat ulang");
  expect(await statusOf(id)).toBe("reviewed");

  const opened = one(await db.select().from(episode));
  const forwarding = { kind: "forward", forwarding: "forwarded_by_officer", seen: "none", seenNote: "" } as const;
  await expect(moderateEpisode(db, moderator, opened.id, { ...forwarding, note: "" })).rejects.toThrow("Isi teks");
  await moderateEpisode(db, moderator, opened.id, { ...forwarding, note: "Diteruskan melalui petugas." });
  expect(await latestAudit()).toMatchObject({ action: "episode.forwarding_changed", entityId: opened.id });

  const later = new Date(opened.firstDetectedAt.getTime() + 25 * 3_600_000);
  expect(one(await getOpenEpisodes(db, later)).overdueHours).toBe(25);
  await replyAsManager(db, manager, { kind: "episode", id: opened.id }, "Kami berkoordinasi dengan sekolah.");
  expect(one(await getOpenEpisodes(db, later)).overdueHours).toBeNull();
  expect(await latestAudit()).toMatchObject({ action: "response.created", actorUserId: manager.uid });

  await moderateEpisode(db, moderator, opened.id, { kind: "close", note: "Tindak lanjut dicatat." });
  expect(await latestAudit()).toMatchObject({ action: "episode.closed", entityId: opened.id });
  await expect(moderateEpisode(db, moderator, opened.id, { kind: "close", note: "Kedua" })).rejects.toThrow(
    "Muat ulang",
  );
});

test("duplicate merges enforce matching school, kind, meal date and prevent chains", async () => {
  const { db, day, secondary, moderator, submit, latestAudit } = await fixture();
  const original = await submit("original");
  const duplicate = await submit("duplicate");

  const invalidTargets = [
    duplicate,
    await submit("other-school", { schoolId: secondary.id }),
    await submit("other-kind", { kind: "experience" }),
    await submit("other-date", { consumedOn: addDays(day, -1) }),
  ];

  for (const targetId of invalidTargets) {
    await expect(moderateReport(db, moderator, duplicate, "received", { kind: "merge", targetId })).rejects.toThrow(
      "laporan induk",
    );
  }

  await moderateReport(db, moderator, duplicate, "received", { kind: "merge", targetId: original });
  expect(await latestAudit()).toMatchObject({ action: "report.merged", after: { duplicateOf: original } });

  const third = await submit("third");
  await expect(
    moderateReport(db, moderator, third, "received", { kind: "merge", targetId: duplicate }),
  ).rejects.toThrow("rantai duplikat");
  await expect(moderateReport(db, moderator, original, "received", { kind: "merge", targetId: third })).rejects.toThrow(
    "rantai duplikat",
  );
});

test("review queue prioritizes teacher groups, paginates, and derives flags without changing status", async () => {
  const { db, now, submit } = await fixture();

  const teacher = await submit("teacher", {
    reporterRole: "teacher",
    subject: "group",
    affectedCount: 5,
    receivedAt: new Date(now.getTime() - 60_000),
  });

  const safety = await submit("safety", { kind: "experience", problems: ["stale"] });
  const withNote = await submit("note", { kind: "experience", note: "Catatan pengalaman." });
  const plain = await submit("plain", { kind: "experience" });

  const repeat = await submit("repeat", {
    ipHash: "burst",
    deviceHash: "repeat-device",
    locationCheck: "outside",
    receivedAt: new Date(now.getTime() - 300_000),
  });

  for (let i = 0; i < 18; i++) {
    await submit(`health-${i}`, {
      ipHash: i < 5 ? "burst" : `health-${i}`,
      deviceHash: i === 0 ? "repeat-device" : `health-${i}`,
    });
  }

  const page1 = await getReviewQueue(db, 1);
  const page2 = await getReviewQueue(db, 2);
  expect(page1.items).toHaveLength(20);
  expect(page1.items[0]?.id).toBe(teacher);
  expect(page1.items[1]).toMatchObject({
    id: repeat,
    surge: true,
    repeated: true,
    locationCheck: "outside",
    status: "received",
  });
  expect(page1.items.find((item) => item.id === teacher)).toMatchObject({ surge: false, repeated: false });
  expect(page1.hasMore).toBe(true);
  expect(page2.items.map((item) => item.id)).toEqual([safety, withNote]);
  expect(page2.items.some((item) => item.id === plain)).toBe(false);
  expect(one(await getSurges(db, now))).toMatchObject({ count: 6, schools: ["SD A"] });
});

test("manager ownership, audit rollback, later reporter updates and report completion", async () => {
  const { db, now, kitchen, other, moderator, manager, secondary, submit, statusOf, latestAudit } = await fixture();
  const hidden = await submit("unreviewed", { note: "Hanya moderator yang bisa melihat ini." });
  const foreign = await submit("foreign", { schoolId: secondary.id, status: "reviewed" });

  const foreignEpisode = one(
    await db
      .insert(episode)
      .values({
        sppgId: other.id,
        rule: "auto_multi_school",
        firstDetectedAt: now,
      })
      .returning(),
  );

  const id = await submit("reviewed", { status: "reviewed" });

  const before = await getManagerDashboard(db, kitchen.id, now, 1);
  expect(before.unreviewed).toBe(1);
  expect(before.items.map((item) => item.id)).toEqual([id]);

  await expect(
    replyAsManager(db, manager, { kind: "report", id: hidden, seen: "received" }, "Jawaban"),
  ).rejects.toThrow("belum bisa");
  await expect(
    replyAsManager(db, manager, { kind: "report", id: foreign, seen: "reviewed" }, "Jawaban"),
  ).rejects.toThrow("tidak tersedia");
  await expect(replyAsManager(db, manager, { kind: "episode", id: foreignEpisode.id }, "Jawaban")).rejects.toThrow(
    "tidak tersedia",
  );

  const auditBefore = await db.select({ id: auditLog.id }).from(auditLog);
  const target = { kind: "report", id, seen: "reviewed" } as const;
  await expect(replyAsManager(db, { ...manager, uid: -1 }, target, "Foreign key failure")).rejects.toHaveProperty(
    "cause.code",
    "23503",
  );
  expect(await statusOf(id)).toBe("reviewed");
  expect(await db.select({ id: auditLog.id }).from(auditLog)).toEqual(auditBefore);

  await replyAsManager(db, manager, target, "Jawaban pengelola");
  expect(await statusOf(id)).toBe("responded");
  expect(await latestAudit()).toMatchObject({ action: "response.created", after: { reportId: id } });
  expect((await getManagerDashboard(db, kitchen.id, now, 1)).items).toHaveLength(0);

  await db.insert(response).values({ reportId: id, body: "Perkembangan privat", authorKind: "reporter" });
  const waiting = one((await getManagerDashboard(db, kitchen.id, now, 1)).items);
  expect(waiting.thread.map((entry) => entry.body)).toEqual(["Jawaban pengelola", "Perkembangan privat"]);
  expect((await getFollowUp(db, 1)).items.find((item) => item.id === id)?.thread).toHaveLength(2);
  const rapor = await getRapor(db, kitchen.id, now);
  expect(rapor?.latest.find((item) => item.id === id)?.reply?.body).toBe("Jawaban pengelola");
  expect(JSON.stringify(rapor)).not.toContain("Perkembangan privat");
  await moderateReport(db, moderator, id, "responded", { kind: "finish" });
  expect(await statusOf(id)).toBe("closed");
});

test("today's menu upserts with audit and demo reset records its moderator", async () => {
  const { db, now, day, kitchen, other, moderator, manager, latestAudit } = await fixture();
  await expect(updateTodayMenu(db, manager, other.id, day, "Nasi", "Nasi putih")).rejects.toThrow("tidak tersedia");
  await expect(updateTodayMenu(db, manager, kitchen.id, addDays(day, -1), "Nasi", "Nasi putih")).rejects.toThrow(
    "hari ini",
  );
  await updateTodayMenu(db, manager, kitchen.id, day, "Nasi", "Nasi putih");
  await updateTodayMenu(db, manager, kitchen.id, day, "Nasi sayur", "Nasi dan sayur");
  expect(one(await db.select().from(menu))).toMatchObject({ name: "Nasi sayur", servedOn: day });
  expect(await latestAudit()).toMatchObject({
    action: "menu.updated",
    before: { name: "Nasi" },
    after: { name: "Nasi sayur" },
  });
  await resetDb(db, now, moderator.uid);
  expect(await latestAudit()).toMatchObject({ action: "demo.reset", actorUserId: moderator.uid });
});
