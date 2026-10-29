import { and, eq } from "drizzle-orm";
import { todayWIB } from "@/lib/date";
import type { Db } from "./index";
import { report, school, sppg } from "./schema";
import { SEED_SPPG } from "./seed-data";
import { simulateDay } from "./simulate";

/** Appends today's simulated reports once per WIB day. Never edits or deletes existing rows. */
export async function topUp(db: Db, now: Date = new Date()): Promise<{ day: string; inserted: number }> {
  const day = todayWIB(now);
  const done = await db
    .select({ id: report.id })
    .from(report)
    .where(and(eq(report.simulated, true), eq(report.consumedOn, day)))
    .limit(1);
  if (done.length > 0) return { day, inserted: 0 };

  const schools = await db
    .select({ id: school.id, sppgId: school.sppgId, code: school.code, sppgName: sppg.name })
    .from(school)
    .innerJoin(sppg, eq(school.sppgId, sppg.id));
  const rows = simulateDay({
    day,
    until: now,
    schools: schools.map((s) => ({
      ...s,
      profile: SEED_SPPG.find((x) => x.name === s.sppgName)?.profile ?? "no_signal",
    })),
  });
  if (rows.length > 0) await db.insert(report).values(rows);
  return { day, inserted: rows.length };
}
