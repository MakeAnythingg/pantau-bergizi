import { expect, test } from "bun:test";
import { todayWIB } from "@/lib/date";
import type { NewReport } from "./schema";
import { type SimSchool, simulateDay } from "./simulate";

const schools: SimSchool[] = [
  { id: 1, sppgId: 1, code: "a1", profile: "priority" },
  { id: 2, sppgId: 1, code: "a2", profile: "priority" },
  { id: 3, sppgId: 1, code: "a3", profile: "priority" },
  { id: 4, sppgId: 2, code: "b1", profile: "attention" },
  { id: 5, sppgId: 2, code: "b2", profile: "attention" },
  { id: 6, sppgId: 3, code: "c1", profile: "no_signal" },
  { id: 7, sppgId: 3, code: "c2", profile: "no_signal" },
  { id: 8, sppgId: 4, code: "d1", profile: "no_data" },
];
const day = "2026-10-29";
const endOfDay = new Date("2026-10-29T23:59:00+07:00");
const rows = simulateDay({ day, until: endOfDay, schools });
const forSppg = (id: number) => rows.filter((r) => schools.find((s) => s.id === r.schoolId)?.sppgId === id);
const health = (rs: NewReport[]) => rs.filter((r) => r.kind === "health");

test("todayWIB rolls over at 17:00 UTC", () => {
  expect(todayWIB(new Date("2026-10-29T16:59:00Z"))).toBe("2026-10-29");
  expect(todayWIB(new Date("2026-10-29T22:00:00Z"))).toBe("2026-10-30");
});

test("simulateDay is deterministic for the same day", () => {
  expect(simulateDay({ day, until: endOfDay, schools })).toEqual(rows);
});

test("every row is simulated, dated to the day, with a unique token", () => {
  expect(rows.every((r) => r.simulated === true && r.consumedOn === day)).toBe(true);
  expect(new Set(rows.map((r) => r.tokenHash)).size).toBe(rows.length);
});

test("priority profile: ≥3 health from ≥2 schools, ≥1 inside", () => {
  const h = health(forSppg(1));
  expect(h.length).toBeGreaterThanOrEqual(3);
  expect(new Set(h.map((r) => r.schoolId)).size).toBeGreaterThanOrEqual(2);
  expect(h.some((r) => r.locationCheck === "inside")).toBe(true);
  expect(forSppg(1).some((r) => r.kind === "experience")).toBe(true);
});

test("attention profile: exactly 1 health report", () => {
  expect(health(forSppg(2))).toHaveLength(1);
});

test("no_signal profile: no health, no stale/foreign_object, avg rating ≥ 3", () => {
  const rs = forSppg(3);
  expect(rs.length).toBeGreaterThan(0);
  expect(health(rs)).toHaveLength(0);
  expect(rs.some((r) => r.problems?.some((p) => p === "stale" || p === "foreign_object"))).toBe(false);
  const avg = rs.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rs.length;
  expect(avg).toBeGreaterThanOrEqual(3);
});

test("no_data profile: zero reports", () => {
  expect(forSppg(4)).toHaveLength(0);
});

test("never generates received_at after `until`", () => {
  const until = new Date("2026-10-29T22:00:00Z"); // 05:00 WIB on 2026-10-30
  const early = simulateDay({ day: "2026-10-30", until, schools });
  expect(early.length).toBeGreaterThan(0);
  for (const r of early) expect(r.receivedAt!.getTime()).toBeLessThanOrEqual(until.getTime());
});

test("a midday top-up clusters reports in the 30 minutes before `until`", () => {
  const until = new Date("2026-10-30T12:40:00+07:00");
  const rows = simulateDay({ day: "2026-10-30", until, schools });
  for (const r of rows) {
    expect(until.getTime() - r.receivedAt!.getTime()).toBeLessThanOrEqual(30 * 60 * 1000);
  }
});
