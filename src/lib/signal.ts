import type { episode, report } from "@/db/schema";
import type { Status } from "./status";
import {
  LOW_RATING_MIN_REPORTS,
  LOW_RATING_THRESHOLD,
  PRIORITY_MIN_HEALTH_REPORTS,
  PRIORITY_MIN_INSIDE,
  PRIORITY_MIN_SCHOOLS,
  TEACHER_GROUP_MIN_AFFECTED,
} from "./thresholds";

type Report = typeof report.$inferSelect;

export type SignalReport = Pick<
  Report,
  | "schoolId"
  | "kind"
  | "reporterRole"
  | "rating"
  | "problems"
  | "symptoms"
  | "subject"
  | "affectedCount"
  | "locationCheck"
  | "status"
  | "duplicateOf"
> & { schoolName: string };

export type Signal = { status: Status; reason: string; label: string | null };

type EpisodeRule = typeof episode.$inferSelect.rule;

const SYMPTOM_WORD: Record<Report["symptoms"][number], string> = {
  nausea: "mual",
  diarrhea: "diare",
  dizzy: "pusing",
  other: "kesehatan",
};

const REVIEWED: ReadonlySet<Report["status"]> = new Set(["reviewed", "responded", "closed"]);

/** Rejected and merged-duplicate reports never count (PRD F2, F8). */
export const counts = (r: Pick<Report, "status" | "duplicateOf">) => r.status !== "rejected" && r.duplicateOf === null;

const attention = (reason: string): Signal => ({ status: "attention", reason, label: null });

const decimal = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });

function healthSummary(health: SignalReport[]) {
  const schools = new Set(health.map((r) => r.schoolId)).size;
  const inside = health.filter((r) => r.locationCheck === "inside").length;
  const [onlySymptom, ...otherSymptoms] = new Set(health.flatMap((r) => r.symptoms));
  const complaint = `keluhan ${onlySymptom && otherSymptoms.length === 0 ? SYMPTOM_WORD[onlySymptom] : "kesehatan"}`;

  return { schools, inside, complaint };
}

const isTeacherGroup = (r: SignalReport) =>
  r.reporterRole === "teacher" && r.subject === "group" && (r.affectedCount ?? 0) >= TEACHER_GROUP_MIN_AFFECTED;

const teacherReason = (r: SignalReport) => `Laporan guru ${r.schoolName}: perkiraan ${r.affectedCount} terdampak`;

export function priorityEvidence<T extends SignalReport>(all: T[], onlyRule?: EpisodeRule) {
  const health = all.filter((r) => counts(r) && r.kind === "health");
  const { schools, inside, complaint } = healthSummary(health);

  if (
    onlyRule !== "teacher_group_reviewed" &&
    health.length >= PRIORITY_MIN_HEALTH_REPORTS &&
    schools >= PRIORITY_MIN_SCHOOLS &&
    inside >= PRIORITY_MIN_INSIDE
  ) {
    return {
      rule: "auto_multi_school" as const,
      reports: health,
      reason: (period: string) =>
        `${health.length} ${complaint} dari ${schools} sekolah ${period}, ${inside} dikirim dari area sekolah.`,
      label: "Otomatis, belum ditinjau moderator",
    };
  }

  const groups = health.filter((r) => isTeacherGroup(r) && REVIEWED.has(r.status));
  const [group] = groups;

  if (onlyRule !== "auto_multi_school" && group) {
    return {
      rule: "teacher_group_reviewed" as const,
      reports: groups,
      reason: () => `${teacherReason(group)}.`,
      label: "Ditinjau moderator",
    };
  }

  return null;
}

/** Status of one SPPG from the reports it received inside the signal window (PRD F2). */
export function computeSignal<T extends SignalReport>(all: T[], eligibleForPriority?: (report: T) => boolean): Signal {
  const reports = all.filter(counts);

  if (reports.length === 0) return { status: "no_data", reason: "Belum ada laporan dalam 24 jam.", label: null };

  const priority = priorityEvidence(eligibleForPriority ? reports.filter(eligibleForPriority) : reports);

  if (priority) {
    return { status: "priority", reason: priority.reason("dalam 24 jam"), label: priority.label };
  }

  const health = reports.filter((r) => r.kind === "health");
  const group = health.find(isTeacherGroup);

  if (group) {
    const reason = teacherReason(group);

    return attention(REVIEWED.has(group.status) ? `${reason}.` : `${reason}, sedang ditinjau moderator.`);
  }

  const { schools: healthSchools, complaint } = healthSummary(health);
  const [onlyHealth] = health;

  if (onlyHealth && health.length === 1) return attention(`1 ${complaint} dari ${onlyHealth.schoolName}.`);

  if (health.length > 1) return attention(`${health.length} ${complaint} dari ${healthSchools} sekolah.`);

  const unsafe = reports.find(
    (r) =>
      r.problems.some((p) => p === "stale" || p === "foreign_object") &&
      (r.locationCheck === "inside" || REVIEWED.has(r.status)),
  );

  if (unsafe) return attention(`Laporan makanan basi atau benda asing dari ${unsafe.schoolName}.`);

  const ratings = reports.flatMap((r) => (r.rating === null ? [] : [r.rating]));
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;

  if (ratings.length >= LOW_RATING_MIN_REPORTS && avg < LOW_RATING_THRESHOLD) {
    return attention(`Rata-rata nilai ${decimal(avg)} dari ${ratings.length} laporan.`);
  }

  const schools = new Set(reports.map((r) => r.schoolId)).size;

  return {
    status: "no_signal",
    reason: `${reports.length} laporan dari ${schools} sekolah, tidak ada keluhan keamanan pangan.`,
    label: null,
  };
}
