import { createHash } from "node:crypto";
import { wibTime } from "@/lib/date";
import type { NewReport } from "./schema";
import { SEED_NOTES, type SignalProfile } from "./seed-data";

export type SimSchool = { id: number; sppgId: number; code: string; profile: SignalProfile };

// mulberry32 — tiny deterministic PRNG so the same day always yields the same reports.
function prng(seedText: string) {
  let a = createHash("sha256").update(seedText).digest().readUInt32LE(0);

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BATCH_SPREAD_MS = 30 * 60 * 1000;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Simulated reports for one WIB day, shaped so each school's SPPG lands in its profile's status.
 * received_at falls in the 30 minutes before the end of lunch hours (10–16 WIB) clamped to `until`, so a
 * daily top-up's batch stays inside the 24h signal window until the next run. If `until` is before 10:00,
 * it falls between midnight and `until` instead. Nothing is generated after `until`.
 */
export function simulateDay({ day, until, schools }: { day: string; until: Date; schools: SimSchool[] }): NewReport[] {
  const dayStart = wibTime(day);

  if (until <= dayStart) return [];
  const lunchStart = wibTime(day, 10);
  const to = new Date(Math.min(until.getTime(), wibTime(day, 16).getTime()));
  const from = until > lunchStart ? new Date(Math.max(lunchStart.getTime(), to.getTime() - BATCH_SPREAD_MS)) : dayStart;

  const rows: NewReport[] = [];
  const healthCountBySppg = new Map<number, number>();

  for (const s of schools) {
    if (s.profile === "no_data") continue;
    const rand = prng(`${day}:${s.id}`);
    const pick = <T>(xs: readonly [T, ...T[]]) => xs[Math.floor(rand() * xs.length)] ?? xs[0];
    const at = () => new Date(from.getTime() + rand() * (to.getTime() - from.getTime()));

    const base = (i: number) => ({
      schoolId: s.id,
      simulated: true,
      consumedOn: day,
      receivedAt: at(),
      tokenHash: sha(`sim-token:${day}:${s.id}:${i}`),
      deviceHash: sha(`sim-device:${day}:${s.id}:${i}`),
      ipHash: sha(`sim-ip:${s.code}`),
    });

    const experienceCount = 2 + Math.floor(rand() * 3);

    for (let i = 0; i < experienceCount; i++) {
      rows.push({
        ...base(i),
        kind: "experience",
        reporterRole: pick(["student", "student", "parent", "teacher"] as const),
        rating: 3 + Math.floor(rand() * 3),
        leftover: pick(["none", "none", "little", "lots"] as const),
        problems: [rand() < 0.15 ? "late" : "none"],
        note: rand() < 0.3 ? pick(SEED_NOTES) : null,
        locationCheck: pick(["inside", "inside", "inside", "unavailable", "outside"] as const),
      });
    }

    // priority: the first two schools of the SPPG report 2 + 1 nausea cases (first one inside the school area).
    // attention: the first school reports a single case.
    const seen = healthCountBySppg.get(s.sppgId) ?? 0;
    healthCountBySppg.set(s.sppgId, seen + 1);

    const healthCount =
      s.profile === "priority" ? ([2, 1][seen] ?? 0) : s.profile === "attention" && seen === 0 ? 1 : 0;

    for (let i = 0; i < healthCount; i++) {
      rows.push({
        ...base(100 + i),
        kind: "health",
        reporterRole: pick(["student", "parent"] as const),
        symptoms: ["nausea"],
        subject: "self",
        locationCheck: i === 0 ? "inside" : pick(["inside", "unavailable"] as const),
      });
    }
  }

  return rows;
}
