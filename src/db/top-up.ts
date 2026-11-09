import { and, eq } from "drizzle-orm";
import { todayWIB } from "@/lib/date";
import { lockKitchen, syncEpisode } from "./episodes";
import type { Db } from "./index";
import { report, school, sppg } from "./schema";
import { SEED_SPPG } from "./seed-data";
import { simulateDay } from "./simulate";

/** Appends today's simulated reports once per WIB day. Never edits or deletes existing rows. */
export async function topUp(db: Db, now: Date = new Date()): Promise<{ day: string; inserted: number }> {
  const day = todayWIB(now);

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

  if (rows.length === 0) return { day, inserted: 0 };

  const schoolIds = new Set(rows.map((r) => r.schoolId));

  const kitchenIds = [...new Set(schools.filter((s) => schoolIds.has(s.id)).map((s) => s.sppgId))].toSorted(
    (a, b) => a - b,
  );

  return db.transaction(async (tx) => {
    // Stable order across cron runs, before touching report rows.
    for (const id of kitchenIds) await lockKitchen(tx, id);

    const done = await tx
      .select({ id: report.id })
      .from(report)
      .where(and(eq(report.simulated, true), eq(report.consumedOn, day)))
      .limit(1);

    if (done.length > 0) return { day, inserted: 0 };

    await tx.insert(report).values(rows);

    for (const id of kitchenIds) await syncEpisode(tx, id, now);

    return { day, inserted: rows.length };
  });
}
