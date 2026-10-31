import { beforeAll, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { keyedHash } from "@/lib/keyed-hash";
import { allowHit } from "@/lib/rate-limit";
import { LACAK_IP_LIMIT, REPORT_IP_LIMIT } from "@/lib/thresholds";
import { addReporterUpdate, findReportByCode, parseReportForm, type ReportInput, submitReport } from "./reports";
import { report, school } from "./schema";
import { seed } from "./seed";
import { getTestDb, truncateAll } from "./test-db";

const now = new Date("2026-10-30T13:00:00+07:00");
const today = "2026-10-30";

type Fields = Record<string, string | string[]>;

function form(fields: Fields): FormData {
  const f = new FormData();

  for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) f.append(k, one);

  return f;
}

const survey = {
  kind: "experience",
  reporterRole: "student",
  consumedOn: today,
  rating: "4",
  leftover: "none",
} satisfies Fields;

const complaint = {
  kind: "health",
  reporterRole: "parent",
  consumedOn: today,
  symptoms: "nausea",
  subject: "self",
} satisfies Fields;

function parsed(fields: Fields): ReportInput {
  const r = parseReportForm(form(fields), today);

  if (!r.ok) throw new Error(r.message);

  return r.report;
}

let harapan: { id: number; lat: number; lng: number };
let cempaka: { id: number; lat: number; lng: number };

beforeAll(async () => {
  const db = await getTestDb();
  await truncateAll(db);
  await seed(db, now);
  const [h] = await db.select().from(school).where(eq(school.code, "sdn-harapan-1"));
  const [c] = await db.select().from(school).where(eq(school.code, "sdn-cempaka-3"));

  if (!h || !c) throw new Error("seeded schools missing");
  harapan = h;
  cempaka = c;
});

const ctx = (
  device: string,
  overrides: { school?: typeof harapan; coords?: { lat: number; lng: number } | null } = {},
) => ({
  school: overrides.school ?? harapan,
  coords: overrides.coords ?? null,
  deviceHash: keyedHash(`device:${device}`),
  ipHash: keyedHash("ip:school-wifi"),
  confirmRepeat: false,
});

test("meal date must be within WIB today−30…today; the bounds are accepted", () => {
  expect(parseReportForm(form({ ...survey, consumedOn: today }), today).ok).toBe(true);
  expect(parseReportForm(form({ ...survey, consumedOn: "2026-09-30" }), today).ok).toBe(true);
  expect(parseReportForm(form({ ...survey, consumedOn: "2026-09-29" }), today).ok).toBe(false);
  expect(parseReportForm(form({ ...survey, consumedOn: "2026-10-31" }), today).ok).toBe(false);
});

test("rejects “none” with another problem, a group report from a non-teacher, and a group without a count", () => {
  expect(parseReportForm(form({ ...survey, problems: ["none", "late"] }), today).ok).toBe(false);
  expect(parseReportForm(form({ ...survey, problems: ["none"] }), today).ok).toBe(true);
  expect(parseReportForm(form({ ...complaint, subject: "group", affectedCount: "12" }), today).ok).toBe(false);
  expect(parseReportForm(form({ ...complaint, reporterRole: "teacher", subject: "group" }), today).ok).toBe(false);
  expect(
    parseReportForm(form({ ...complaint, reporterRole: "teacher", subject: "group", affectedCount: "12" }), today).ok,
  ).toBe(true);
});

test("a second survey from the same device, school, and date is a duplicate; another date or school is fine", async () => {
  const db = await getTestDb();
  expect((await submitReport(db, parsed(survey), ctx("dup"))).kind).toBe("ok");
  expect(await submitReport(db, parsed(survey), ctx("dup"))).toEqual({ kind: "duplicate" });
  expect((await submitReport(db, parsed({ ...survey, consumedOn: "2026-10-29" }), ctx("dup"))).kind).toBe("ok");
  expect((await submitReport(db, parsed(survey), ctx("dup", { school: cempaka }))).kind).toBe("ok");
});

test("a repeat health report returns the notice and is stored once confirmed", async () => {
  const db = await getTestDb();
  expect((await submitReport(db, parsed(complaint), ctx("sick"))).kind).toBe("ok");
  expect(await submitReport(db, parsed(complaint), ctx("sick"))).toEqual({ kind: "repeat_health" });
  expect((await submitReport(db, parsed(complaint), { ...ctx("sick"), confirmRepeat: true })).kind).toBe("ok");

  const stored = await db
    .select()
    .from(report)
    .where(eq(report.deviceHash, keyedHash("device:sick")));

  expect(stored).toHaveLength(2);
});

test("two devices on the same IP can both submit", async () => {
  const db = await getTestDb();

  expect((await submitReport(db, parsed(survey), ctx("wifi-a"))).kind).toBe("ok");
  expect((await submitReport(db, parsed(survey), ctx("wifi-b"))).kind).toBe("ok");
});

test("location maps to inside, outside, or unavailable, and only that is stored", async () => {
  const db = await getTestDb();

  const cases = [
    ["loc-in", { lat: harapan.lat, lng: harapan.lng }, "inside"],
    ["loc-out", { lat: harapan.lat + 0.01, lng: harapan.lng }, "outside"],
    ["loc-none", null, "unavailable"],
  ] as const;

  for (const [device, coords, expected] of cases) {
    const result = await submitReport(db, parsed(survey), ctx(device, { coords }));

    if (result.kind !== "ok") throw new Error(result.kind);

    const [row] = await db
      .select()
      .from(report)
      .where(eq(report.deviceHash, keyedHash(`device:${device}`)));

    expect(row?.locationCheck).toBe(expected);
    expect(JSON.stringify(row)).not.toContain(String(harapan.lat));
  }
});

test("the issued code finds its report, also lowercase and without the dash; a wrong code finds nothing", async () => {
  const db = await getTestDb();
  const result = await submitReport(db, parsed(complaint), ctx("tracked"));

  if (result.kind !== "ok") throw new Error(result.kind);
  expect(result.code).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);

  const found = await findReportByCode(db, result.code);
  expect(found).toMatchObject({ kind: "health", schoolName: "SDN Harapan 1", status: "received", responses: [] });
  expect((await findReportByCode(db, result.code.replace("-", " ").toLowerCase()))?.id).toBe(found?.id ?? -1);
  expect(await findReportByCode(db, "ZZZZZ-ZZZZZ")).toBeNull();
  expect(await findReportByCode(db, "not a code")).toBeNull();

  expect(await addReporterUpdate(db, result.code, "Anak saya sudah membaik.")).toBe(true);
  expect((await findReportByCode(db, result.code))?.responses).toMatchObject([
    { authorKind: "reporter", body: "Anak saya sudah membaik." },
  ]);
  expect(await addReporterUpdate(db, "ZZZZZ-ZZZZZ", "x")).toBe(false);
});

test("report:ip and lacak:ip limits trip at their thresholds", async () => {
  const db = await getTestDb();

  for (const [key, rule] of [
    [`report:ip:${keyedHash("ip:flood")}`, REPORT_IP_LIMIT],
    [`lacak:ip:${keyedHash("ip:flood")}`, LACAK_IP_LIMIT],
  ] as const) {
    const results = [];

    for (let i = 0; i <= rule.limit; i++) results.push(await allowHit(db, key, rule, now));
    expect(results.filter(Boolean)).toHaveLength(rule.limit);
    expect(results.at(-1)).toBe(false);
  }
});
