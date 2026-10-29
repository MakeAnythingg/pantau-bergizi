import { and, asc, desc, eq, gte, ilike, inArray } from "drizzle-orm";
import { addDays, todayWIB } from "@/lib/date";
import { computeSignal, counts } from "@/lib/signal";
import type { Status } from "@/lib/status";
import { LEFTOVER_MIN_REPORTS, LEFTOVER_WINDOW_DAYS, SIGNAL_WINDOW_HOURS } from "@/lib/thresholds";
import type { Db } from "./index";
import { menu, report, response, school, sppg } from "./schema";

const RANK: Record<Status, number> = { priority: 0, attention: 1, no_signal: 2, no_data: 3 };
const TREND_DAYS = 7;
const LATEST_LIMIT = 8;

const windowStart = (now: Date) => new Date(now.getTime() - SIGNAL_WINDOW_HOURS * 3_600_000);

const reportFields = {
  id: report.id,
  schoolId: report.schoolId,
  schoolName: school.name,
  sppgId: school.sppgId,
  kind: report.kind,
  reporterRole: report.reporterRole,
  consumedOn: report.consumedOn,
  receivedAt: report.receivedAt,
  rating: report.rating,
  leftover: report.leftover,
  problems: report.problems,
  symptoms: report.symptoms,
  subject: report.subject,
  affectedCount: report.affectedCount,
  note: report.note,
  locationCheck: report.locationCheck,
  status: report.status,
  duplicateOf: report.duplicateOf,
};

function reportsSince(db: Db, since: Date, sppgId?: number) {
  return db
    .select(reportFields)
    .from(report)
    .innerJoin(school, eq(report.schoolId, school.id))
    .where(and(gte(report.receivedAt, since), sppgId === undefined ? undefined : eq(school.sppgId, sppgId)))
    .orderBy(desc(report.receivedAt));
}

type Row = Awaited<ReturnType<typeof reportsSince>>[number];

const reportedSchools = (rows: Row[]) => new Set(rows.filter(counts).map((r) => r.schoolId));

/** Every kitchen with today's status, most urgent first (Beranda). */
export async function getBoard(db: Db, now: Date) {
  const [kitchens, schools, rows] = await Promise.all([
    db.select().from(sppg),
    db.select({ id: school.id, sppgId: school.sppgId }).from(school),
    reportsSince(db, windowStart(now)),
  ]);
  return kitchens
    .map((k) => {
      const own = rows.filter((r) => r.sppgId === k.id);
      return {
        ...k,
        signal: computeSignal(own),
        reported: reportedSchools(own).size,
        total: schools.filter((s) => s.sppgId === k.id).length,
      };
    })
    .sort((a, b) => RANK[a.signal.status] - RANK[b.signal.status] || a.name.localeCompare(b.name));
}

export type BoardKitchen = Awaited<ReturnType<typeof getBoard>>[number];

/** Schools whose name contains `q`, for "Cari sekolah anak Anda". */
export function searchSchools(db: Db, q: string) {
  const term = q.trim().slice(0, 60).replace(/[\\%_]/g, "\\$&");
  return db
    .select({ code: school.code, name: school.name, sppgId: school.sppgId, sppgName: sppg.name })
    .from(school)
    .innerJoin(sppg, eq(school.sppgId, sppg.id))
    .where(ilike(school.name, `%${term}%`))
    .orderBy(asc(school.name))
    .limit(8);
}

/** One kitchen's daily rapor, or null for an unknown id. */
export async function getRapor(db: Db, sppgId: number, now: Date) {
  const [kitchen] = await db.select().from(sppg).where(eq(sppg.id, sppgId));
  if (!kitchen) return null;

  const today = todayWIB(now);
  const firstDay = addDays(today, -(Math.max(TREND_DAYS, LEFTOVER_WINDOW_DAYS) - 1));
  const [schools, [todayMenu], rows] = await Promise.all([
    db.select().from(school).where(eq(school.sppgId, sppgId)).orderBy(asc(school.id)),
    db.select().from(menu).where(and(eq(menu.sppgId, sppgId), eq(menu.servedOn, today))),
    reportsSince(db, new Date(`${firstDay}T00:00:00+07:00`), sppgId),
  ]);

  const counted = rows.filter(counts);
  const inWindow = rows.filter((r) => r.receivedAt >= windowStart(now));
  const reported = reportedSchools(inWindow);

  const ratedToday = counted.filter((r) => r.consumedOn === today && r.rating !== null);
  const leftover = counted.filter((r) => r.leftover !== null && r.consumedOn >= addDays(today, 1 - LEFTOVER_WINDOW_DAYS));
  const experience = {
    rating: ratedToday.length ? ratedToday.reduce((a, r) => a + (r.rating ?? 0), 0) / ratedToday.length : null,
    rated: ratedToday.length,
    leftoverLots:
      leftover.length >= LEFTOVER_MIN_REPORTS
        ? leftover.filter((r) => r.leftover === "lots").length / leftover.length
        : null,
    health: inWindow.filter((r) => counts(r) && r.kind === "health").length,
  };

  const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const day = addDays(today, i - TREND_DAYS + 1);
    const dayRows = counted.filter((r) => todayWIB(r.receivedAt) === day);
    return { day, reports: dayRows.length, health: dayRows.some((r) => r.kind === "health") };
  });

  const latestRows = [...counted].sort((a, b) => Number(b.kind === "health") - Number(a.kind === "health")).slice(0, LATEST_LIMIT);
  const replies = latestRows.length
    ? await db
        .select({ reportId: response.reportId, body: response.body, createdAt: response.createdAt })
        .from(response)
        .where(
          and(
            inArray(
              response.reportId,
              latestRows.map((r) => r.id),
            ),
            eq(response.authorKind, "sppg"),
          ),
        )
        .orderBy(desc(response.createdAt))
    : [];
  const latest = latestRows.map((r) => ({ ...r, reply: replies.find((x) => x.reportId === r.id) ?? null }));

  return {
    kitchen,
    signal: computeSignal(inWindow),
    schools: schools.map((s) => ({ ...s, reported: reported.has(s.id) })),
    menu: todayMenu ?? null,
    experience,
    trend,
    latest,
  };
}

export type Rapor = NonNullable<Awaited<ReturnType<typeof getRapor>>>;
