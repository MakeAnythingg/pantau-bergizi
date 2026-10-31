import { and, asc, DrizzleQueryError, eq } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";
import { addDays } from "@/lib/date";
import { locationCheck } from "@/lib/geo";
import { type KeyedHash, keyedHash } from "@/lib/keyed-hash";
import { CONSUMED_ON_MAX_BACKDATE_DAYS, NOTE_MAX_CHARS } from "@/lib/thresholds";
import { newTrackingCode, normalizeTrackingCode } from "@/lib/tracking-code";
import type { Db } from "./index";
import {
  leftoverEnum,
  problemEnum,
  report,
  reporterRoleEnum,
  response,
  school,
  sppg,
  subjectEnum,
  symptomEnum,
} from "./schema";

/** The school a QR points at, with what the form and the location check need, or null for an unknown code. */
export async function findSchool(db: Db, code: string) {
  const [found] = await db
    .select({
      id: school.id,
      code: school.code,
      name: school.name,
      lat: school.lat,
      lng: school.lng,
      sppgName: sppg.name,
    })
    .from(school)
    .innerJoin(sppg, eq(school.sppgId, sppg.id))
    .where(eq(school.code, code));

  return found ?? null;
}

export const NOTE_TOO_LONG = `Catatan maksimal ${NOTE_MAX_CHARS} karakter.`;

const note = z.preprocess(
  (v) => v ?? "",
  z
    .string()
    .trim()
    .max(NOTE_MAX_CHARS, NOTE_TOO_LONG)
    .transform((v) => v || null),
);

const shared = {
  reporterRole: z.enum(reporterRoleEnum.enumValues, { error: "Pilih siapa kamu." }),
  consumedOn: z.iso.date({ error: "Pilih tanggal makan." }),
  note,
};

const experience = z.object({
  kind: z.literal("experience"),
  ...shared,
  rating: z.coerce.number({ error: "Pilih nilai 1–5." }).int().min(1, "Pilih nilai 1–5.").max(5, "Pilih nilai 1–5."),
  leftover: z.enum(leftoverEnum.enumValues, { error: "Pilih seberapa habis makanannya." }),
  problems: z
    .array(z.enum(problemEnum.enumValues))
    .transform((p) => [...new Set(p)])
    .refine(
      (p) => !p.includes("none") || p.length === 1,
      "“Tidak ada masalah” tidak bisa dipilih bersama masalah lain.",
    ),
});

const health = z
  .object({
    kind: z.literal("health"),
    ...shared,
    symptoms: z
      .array(z.enum(symptomEnum.enumValues))
      .min(1, "Pilih minimal satu gejala.")
      .transform((s) => [...new Set(s)]),
    subject: z.enum(subjectEnum.enumValues, { error: "Pilih siapa yang mengalami." }),
    affectedCount: z.preprocess(
      (v) => (v === "" || v === null ? null : v),
      z.coerce.number().int().min(1, "Jumlah terdampak minimal 1.").max(5000).nullable(),
    ),
  })
  .superRefine((r, ctx) => {
    if (r.subject === "group" && r.reporterRole !== "teacher") {
      ctx.addIssue({ code: "custom", message: "Pengamatan kelompok hanya untuk Guru/UKS." });
    }

    if (r.subject === "group" && r.affectedCount === null) {
      ctx.addIssue({ code: "custom", message: "Isi perkiraan jumlah terdampak." });
    }
  })
  .transform((r) => ({ ...r, affectedCount: r.subject === "group" ? r.affectedCount : null }));

const reportSchema = z.discriminatedUnion("kind", [experience, health], { error: "Pilih jenis laporan." });

export type ReportInput = z.infer<typeof reportSchema>;

type Parsed = { ok: true; report: ReportInput } | { ok: false; message: string };

/** The form, parsed into one of the two paths. The meal date must fall within the backdate window (WIB). */
export function parseReportForm(form: FormData, today: string): Parsed {
  const result = reportSchema.safeParse({
    kind: form.get("kind"),
    reporterRole: form.get("reporterRole"),
    consumedOn: form.get("consumedOn"),
    rating: form.get("rating"),
    leftover: form.get("leftover"),
    problems: form.getAll("problems"),
    symptoms: form.getAll("symptoms"),
    subject: form.get("subject"),
    affectedCount: form.get("affectedCount"),
    note: form.get("note"),
  });

  if (!result.success) return { ok: false, message: result.error.issues[0]?.message ?? "Periksa kembali isian." };
  const { consumedOn } = result.data;

  if (consumedOn > today || consumedOn < addDays(today, -CONSUMED_ON_MAX_BACKDATE_DAYS)) {
    return {
      ok: false,
      message: `Tanggal makan harus antara ${CONSUMED_ON_MAX_BACKDATE_DAYS} hari lalu dan hari ini.`,
    };
  }

  return { ok: true, report: result.data };
}

type Point = { lat: number; lng: number };

export type SubmitContext = {
  school: Point & { id: number };
  /** Raw coordinates from the browser, or null. Used once for the location check and never stored. */
  coords: Point | null;
  deviceHash: KeyedHash;
  ipHash: KeyedHash;
  /** The reporter saw the repeat-health notice and chose "Tetap kirim". */
  confirmRepeat: boolean;
};

export type SubmitResult = { kind: "ok"; code: string } | { kind: "duplicate" } | { kind: "repeat_health" };

const ONE_SURVEY_INDEX = "report_one_survey_per_device";

/** Stores a new report and returns its tracking code (PRD F1, F8). Never drops a health report silently. */
export async function submitReport(db: Db, input: ReportInput, ctx: SubmitContext): Promise<SubmitResult> {
  if (input.kind === "health" && !ctx.confirmRepeat) {
    const [earlier] = await db
      .select({ id: report.id })
      .from(report)
      .where(
        and(
          eq(report.deviceHash, ctx.deviceHash),
          eq(report.schoolId, ctx.school.id),
          eq(report.consumedOn, input.consumedOn),
          eq(report.kind, "health"),
        ),
      )
      .limit(1);

    if (earlier) return { kind: "repeat_health" };
  }

  const code = newTrackingCode();

  const answers =
    input.kind === "experience"
      ? { rating: input.rating, leftover: input.leftover, problems: input.problems }
      : { symptoms: input.symptoms, subject: input.subject, affectedCount: input.affectedCount };

  try {
    await db.insert(report).values({
      schoolId: ctx.school.id,
      reporterRole: input.reporterRole,
      kind: input.kind,
      consumedOn: input.consumedOn,
      note: input.note,
      ...answers,
      locationCheck: locationCheck(ctx.coords, ctx.school),
      tokenHash: keyedHash(normalizeTrackingCode(code) ?? code),
      deviceHash: ctx.deviceHash,
      ipHash: ctx.ipHash,
    });
  } catch (error) {
    // The partial unique index is the race-proof "one survey" rule; its violation is an expected answer.
    if (
      error instanceof DrizzleQueryError &&
      error.cause instanceof postgres.PostgresError &&
      error.cause.constraint_name === ONE_SURVEY_INDEX
    ) {
      return { kind: "duplicate" };
    }

    throw error;
  }

  return { kind: "ok", code };
}

/** The report behind a tracking code with its responses in time order, or null for an unknown code. */
export async function findReportByCode(db: Db, code: string) {
  const normalized = normalizeTrackingCode(code);

  if (!normalized) return null;

  const [found] = await db
    .select({
      id: report.id,
      kind: report.kind,
      schoolName: school.name,
      consumedOn: report.consumedOn,
      status: report.status,
      rejectReason: report.rejectReason,
    })
    .from(report)
    .innerJoin(school, eq(report.schoolId, school.id))
    .where(eq(report.tokenHash, keyedHash(normalized)));

  if (!found) return null;

  const responses = await db
    .select({ id: response.id, authorKind: response.authorKind, body: response.body, createdAt: response.createdAt })
    .from(response)
    .where(eq(response.reportId, found.id))
    .orderBy(asc(response.createdAt), asc(response.id));

  return { ...found, responses };
}

export type TrackedReport = NonNullable<Awaited<ReturnType<typeof findReportByCode>>>;

/** Adds the reporter's own update (never public). Returns false for an unknown code. */
export async function addReporterUpdate(db: Db, code: string, body: string): Promise<boolean> {
  const found = await findReportByCode(db, code);

  if (!found) return false;
  await db.insert(response).values({ reportId: found.id, body, authorKind: "reporter" });

  return true;
}
