import { beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { getBoard, getRapor, searchSchools } from "./board";
import { report, school } from "./schema";
import { seed } from "./seed";
import { getTestDb, truncateAll } from "./test-db";

const now = new Date("2026-10-30T13:00:00+07:00");

beforeAll(async () => {
  const db = await getTestDb();
  await truncateAll(db);
  await seed(db, now);
});

test("board lists kitchens by urgency with their seeded status and coverage", async () => {
  const board = await getBoard(await getTestDb(), now);
  expect(board.map((k) => [k.name, k.signal.status])).toEqual([
    ["SPPG Melati 01", "priority"],
    ["SPPG Kenanga 02", "attention"],
    ["SPPG Flamboyan 01", "no_signal"],
    ["SPPG Dahlia 03", "no_data"],
  ]);
  expect(board.map((k) => `${k.reported}/${k.total}`)).toEqual(["4/4", "3/3", "5/5", "0/3"]);
});

test("rapor has today's menu, schools, a 7-day trend and recent reports", async () => {
  const db = await getTestDb();
  const melati = (await getBoard(db, now)).at(0);
  const rapor = await getRapor(db, melati?.id ?? 0, now);
  expect(rapor?.signal.status).toBe("priority");
  expect(rapor?.menu?.name).toBeString();
  expect(rapor?.schools).toHaveLength(4);
  expect(rapor?.trend.map((d) => d.day)).toEqual([
    "2026-10-24",
    "2026-10-25",
    "2026-10-26",
    "2026-10-27",
    "2026-10-28",
    "2026-10-29",
    "2026-10-30",
  ]);
  expect(rapor?.trend.at(-1)?.health).toBe(true);
  expect(rapor?.trend[0]?.health).toBe(false);
  expect(rapor?.experience.health).toBe(3);
  expect(rapor?.latest[0]?.kind).toBe("health");
});

test("a kitchen without today's menu or reports still has a rapor", async () => {
  const db = await getTestDb();
  const dahlia = (await getBoard(db, now)).at(-1);
  const rapor = await getRapor(db, dahlia?.id ?? 0, now);
  expect(rapor?.menu).toBeNull();
  expect(rapor?.signal.status).toBe("no_data");
});

test("unknown kitchen → null", async () => {
  expect(await getRapor(await getTestDb(), 999_999, now)).toBeNull();
});

test("school search matches names and treats % literally", async () => {
  const db = await getTestDb();
  expect((await searchSchools(db, "harapan")).map((s) => s.name)).toEqual(["SDN Harapan 1", "SMPN Harapan 2"]);
  expect(await searchSchools(db, "%")).toEqual([]);
});

test("reports about meals eaten long ago don't drive today's status", async () => {
  const db = await getTestDb();
  const dahlia = (await getBoard(db, now)).at(-1);

  const schools = await db
    .select()
    .from(school)
    .where(eq(school.sppgId, dahlia?.id ?? 0));

  const [first, second] = schools;

  if (!first || !second) throw new Error("Dahlia needs two schools");
  await db.insert(report).values(
    [first, first, second].map((s, n) => ({
      schoolId: s.id,
      reporterRole: "parent" as const,
      kind: "health" as const,
      consumedOn: "2026-10-15",
      receivedAt: new Date(now.getTime() - 3_600_000),
      symptoms: ["nausea" as const],
      subject: "self" as const,
      locationCheck: "inside" as const,
      tokenHash: `old-${n}`,
      deviceHash: `old-${n}`,
      ipHash: "old",
    })),
  );
  expect((await getBoard(db, now)).at(-1)?.signal.status).toBe("no_data");
  expect((await getRapor(db, dahlia?.id ?? 0, now))?.signal.status).toBe("no_data");
});
