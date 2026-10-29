import { sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { addDays, todayWIB, wibTime } from "@/lib/date";
import type { Db, DbOrTx } from "./index";
import { menu, report, school, sppg, user } from "./schema";
import { DEMO_PASSWORD, MODERATOR_EMAIL, SEED_MENUS, SEED_SPPG } from "./seed-data";
import { type SimSchool, simulateDay } from "./simulate";

const SEED_DAYS = 7;

export async function truncateAll(db: DbOrTx): Promise<void> {
  await db.execute(sql`TRUNCATE response, episode, report, menu, "user", school, sppg RESTART IDENTITY CASCADE`);
}

/** Seeds an empty database with Kota Sukamaju simulation data. Insert order is fixed so ids are stable. */
export async function seed(db: DbOrTx, now: Date = new Date()): Promise<void> {
  const existing = await db.select({ id: sppg.id }).from(sppg).limit(1);
  if (existing.length > 0) throw new Error("Database is not empty — use `bun run db:reset --yes` instead.");

  const today = todayWIB(now);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await db.insert(user).values({ email: MODERATOR_EMAIL, passwordHash, role: "moderator" });

  const simSchools: SimSchool[] = [];
  for (const [i, s] of SEED_SPPG.entries()) {
    const [row] = await db.insert(sppg).values({ name: s.name, district: s.district }).returning();
    const schools = await db
      .insert(school)
      .values(s.schools.map((sc) => ({ ...sc, sppgId: row.id })))
      .returning();
    simSchools.push(...schools.map((sc) => ({ id: sc.id, sppgId: row.id, code: sc.code, profile: s.profile })));

    if (s.managerEmail) {
      await db.insert(user).values({ email: s.managerEmail, passwordHash, role: "sppg_manager", sppgId: row.id });
    }

    const menuDays = Array.from({ length: SEED_DAYS }, (_, d) => addDays(today, -d)).filter(
      (day) => !(s.profile === "no_data" && day === today),
    );
    await db.insert(menu).values(
      menuDays.map((day, d) => ({
        sppgId: row.id,
        servedOn: day,
        ...SEED_MENUS[(d + i) % SEED_MENUS.length],
        updatedAt: wibTime(day, 7),
      })),
    );
  }

  for (let d = SEED_DAYS - 1; d >= 0; d--) {
    const day = addDays(today, -d);
    const isToday = d === 0;
    const schools = isToday
      ? simSchools
      : simSchools.map((s) => ({ ...s, profile: s.profile === "no_data" ? s.profile : ("no_signal" as const) }));
    const rows = simulateDay({ day, until: isToday ? now : wibTime(addDays(day, 1)), schools });
    if (rows.length > 0) await db.insert(report).values(rows);
  }
}

/** Truncate + seed in one transaction, so a failed reset leaves the previous data in place. */
export async function resetDb(db: Db, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    await truncateAll(tx);
    await seed(tx, now);
  });
}

export function assertResetAllowed(demoMode: boolean, argv: string[]): void {
  if (!demoMode) throw new Error("Refusing to reset: DEMO_MODE is not 'true'.");
  if (!argv.includes("--yes")) throw new Error("Refusing to reset: pass --yes to confirm.");
}
