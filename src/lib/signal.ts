import type { report } from "@/db/schema";
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

const SYMPTOM_WORD: Record<Report["symptoms"][number], string> = {
  nausea: "mual",
  diarrhea: "diare",
  dizzy: "pusing",
  other: "kesehatan",
};

const REVIEWED: ReadonlySet<Report["status"]> = new Set(["reviewed", "responded", "closed"]);

/** Rejected and merged-duplicate reports never count (PRD F2, F8). */
export const counts = (r: Pick<Report, "status" | "duplicateOf">) => r.status !== "rejected" && r.duplicateOf === null;

const decimal = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });

/** Status of one SPPG from the reports it received inside the signal window (PRD F2). */
export function computeSignal(all: SignalReport[]): Signal {
  const reports = all.filter(counts);
  if (reports.length === 0) return { status: "no_data", reason: "Belum ada laporan dalam 24 jam.", label: null };

  const health = reports.filter((r) => r.kind === "health");
  const healthSchools = new Set(health.map((r) => r.schoolId));
  const inside = health.filter((r) => r.locationCheck === "inside").length;
  const symptoms = new Set(health.flatMap((r) => r.symptoms));
  const complaint = `keluhan ${symptoms.size === 1 ? SYMPTOM_WORD[[...symptoms][0]] : "kesehatan"}`;

  if (
    health.length >= PRIORITY_MIN_HEALTH_REPORTS &&
    healthSchools.size >= PRIORITY_MIN_SCHOOLS &&
    inside >= PRIORITY_MIN_INSIDE
  ) {
    return {
      status: "priority",
      reason: `${health.length} ${complaint} dari ${healthSchools.size} sekolah dalam 24 jam, ${inside} dikirim dari area sekolah.`,
      label: "Otomatis, belum ditinjau moderator",
    };
  }

  const groups = health.filter(
    (r) => r.reporterRole === "teacher" && r.subject === "group" && (r.affectedCount ?? 0) >= TEACHER_GROUP_MIN_AFFECTED,
  );
  const group = groups.find((r) => REVIEWED.has(r.status)) ?? groups[0];
  const groupReason = group && `Laporan guru ${group.schoolName}: perkiraan ${group.affectedCount} terdampak`;
  if (group && REVIEWED.has(group.status)) {
    return { status: "priority", reason: `${groupReason}.`, label: "Ditinjau moderator" };
  }

  const attention = (reason: string): Signal => ({ status: "attention", reason, label: null });
  if (group) return attention(`${groupReason}, sedang ditinjau moderator.`);
  if (health.length === 1) return attention(`1 ${complaint} dari ${health[0].schoolName}.`);
  if (health.length > 1) return attention(`${health.length} ${complaint} dari ${healthSchools.size} sekolah.`);

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
