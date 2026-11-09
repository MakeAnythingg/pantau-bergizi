import { and, eq, isNull, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { addDays, todayWIB, wibTime } from "@/lib/date";
import { closeEpisode, lockKitchen, syncEpisode } from "./episodes";
import { type Db, type DbOrTx, one, type Tx } from "./index";
import { episode, menu, report, response, school, sppg, user } from "./schema";
import { DEMO_PASSWORD, MODERATOR_EMAIL, SEED_MENUS, SEED_SPPG } from "./seed-data";
import { type SimSchool, simulateDay } from "./simulate";

const SEED_DAYS = 7;

/** Empties every table except audit_log, which outlives resets. */
export async function truncateAll(db: DbOrTx): Promise<void> {
  await db.execute(
    sql`TRUNCATE response, episode, report, menu, "user", school, sppg, rate_limit RESTART IDENTITY CASCADE`,
  );
}

/** Seeds an empty database with Kota Sukamaju simulation data. Insert order is fixed so ids are stable. */
export function seed(db: Db, now: Date = new Date()): Promise<void> {
  return db.transaction((tx) => seedDemo(tx, now));
}

async function seedDemo(db: Tx, now: Date): Promise<void> {
  const existing = await db.select({ id: sppg.id }).from(sppg).limit(1);

  if (existing.length > 0) throw new Error("Database is not empty — use `bun run db:reset --yes` instead.");

  const today = todayWIB(now);
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const moderator = one(
    await db
      .insert(user)
      .values({ email: MODERATOR_EMAIL, passwordHash, role: "moderator" })
      .returning({ id: user.id }),
  );

  const simSchools: SimSchool[] = [];

  for (const [i, s] of SEED_SPPG.entries()) {
    const row = one(await db.insert(sppg).values({ name: s.name, district: s.district }).returning());

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
        ...(SEED_MENUS[(d + i) % SEED_MENUS.length] ?? SEED_MENUS[0]),
        updatedAt: wibTime(day, 7),
      })),
    );
  }

  const melati = simSchools.filter((s) => s.profile === "priority");
  const kenanga = simSchools.filter((s) => s.profile === "attention");
  const flamboyan = simSchools.filter((s) => s.profile === "no_signal");

  for (const schools of [melati, kenanga, flamboyan]) await lockKitchen(db, one(schools).sppgId);

  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  const closedAt = hoursAgo(49);
  const closedId = await seedComplaints(db, melati, "closed", hoursAgo(50));
  await closeEpisode(
    db,
    closedId,
    "Simulasi: hasil peninjauan dan tindak lanjut sudah dicatat.",
    moderator.id,
    closedAt,
  );
  await seedComplaints(db, melati, "overdue", hoursAgo(25));
  const answeredId = await seedComplaints(db, kenanga, "answered", hoursAgo(2));
  await db.insert(response).values({
    episodeId: answeredId,
    authorKind: "sppg",
    body: "Simulasi: pengelola sedang memeriksa catatan penyajian dan bahan makanan.",
    createdAt: hoursAgo(1),
  });
  // Two reports at separate schools are ready for a third complaint through the public form.
  await insertDemoComplaints(db, flamboyan, "pending", now, 2);

  for (let d = SEED_DAYS - 1; d >= 0; d--) {
    const day = addDays(today, -d);
    const isToday = d === 0;

    const schools = isToday
      ? simSchools
      : simSchools.map((s) => ({ ...s, profile: s.profile === "no_data" ? s.profile : ("no_signal" as const) }));

    const rows = simulateDay({ day, until: isToday ? now : wibTime(addDays(day, 1)), schools });

    if (rows.length > 0) await db.insert(report).values(rows);
  }

  for (const schools of [melati, kenanga, flamboyan]) await syncEpisode(db, one(schools).sppgId, now);
}

async function insertDemoComplaints(tx: Tx, schools: SimSchool[], fixture: string, at: Date, count = 3) {
  const [first, second] = schools;

  if (!first || !second) throw new Error("Episode fixtures need two schools");

  await tx.insert(report).values(
    [first, second, first].slice(0, count).map((s, i) => ({
      schoolId: s.id,
      simulated: true,
      consumedOn: todayWIB(at),
      receivedAt: at,
      kind: "health" as const,
      reporterRole: "parent" as const,
      subject: "self" as const,
      symptoms: ["nausea" as const],
      locationCheck: i === 0 ? ("inside" as const) : ("unavailable" as const),
      tokenHash: `episode-demo-token:${fixture}:${i}`,
      deviceHash: `episode-demo-device:${fixture}:${i}`,
      ipHash: "episode-demo",
    })),
  );
}

async function seedComplaints(tx: Tx, schools: SimSchool[], fixture: string, at: Date) {
  const { sppgId } = one(schools);
  await insertDemoComplaints(tx, schools, fixture, at);
  await syncEpisode(tx, sppgId, at);

  const [open] = await tx
    .select({ id: episode.id })
    .from(episode)
    .where(and(eq(episode.sppgId, sppgId), isNull(episode.closedAt)));

  if (!open) throw new Error(`Expected an open episode for ${fixture}`);

  return open.id;
}

/** Truncate + seed + audit row in one transaction, so a failed reset leaves the previous data in place. */
export async function resetDb(db: Db, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    await truncateAll(tx);
    await seedDemo(tx, now);
    await audit(tx, {
      action: "demo.reset",
      actorUserId: null,
      entity: "database",
      entityId: null,
      before: null,
      after: { seededFor: todayWIB(now) },
    });
  });
}

export function assertResetAllowed(demoMode: boolean, argv: string[]): void {
  if (!demoMode) throw new Error("Refusing to reset: DEMO_MODE is not 'true'.");

  if (!argv.includes("--yes")) throw new Error("Refusing to reset: pass --yes to confirm.");
}
