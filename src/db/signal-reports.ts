import { addDays, todayWIB } from "@/lib/date";
import { SIGNAL_WINDOW_HOURS } from "@/lib/thresholds";
import { report, school } from "./schema";

export const windowStart = (now: Date) => new Date(now.getTime() - SIGNAL_WINDOW_HOURS * 3_600_000);

/** Today's signal uses reports received in the window about a meal from today or yesterday (PRD F2). */
export function feedsSignal(now: Date) {
  const since = windowStart(now);
  const today = todayWIB(now);
  const oldestMeal = addDays(today, -1);

  return (r: Pick<typeof report.$inferSelect, "receivedAt" | "consumedOn">) =>
    r.receivedAt >= since && r.receivedAt <= now && r.consumedOn >= oldestMeal && r.consumedOn <= today;
}

export const reportFields = {
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
  episodeId: report.episodeId,
};
