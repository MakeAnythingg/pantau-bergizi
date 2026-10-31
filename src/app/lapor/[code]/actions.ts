"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { findSchool, parseReportForm, submitReport } from "@/db/reports";
import { clientIpHash } from "@/lib/client-ip";
import { todayWIB } from "@/lib/date";
import { deviceHash } from "@/lib/device";
import { allowHit } from "@/lib/rate-limit";
import { REPORT_IP_LIMIT } from "@/lib/thresholds";
import { verifyTurnstile } from "@/lib/turnstile";

export type ReportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "repeat_health" }
  | { status: "done"; kind: "experience" | "health"; code: string };

const error = (message: string): ReportState => ({ status: "error", message });

const degrees = (max: number) => z.string().min(1).transform(Number).pipe(z.number().min(-max).max(max));

// Everything the action reads besides the answers. Missing or malformed coordinates mean "no location".
const envelope = z.object({
  token: z.string().catch(""),
  school: z.string().max(80).catch(""),
  coords: z
    .object({ lat: degrees(90), lng: degrees(180) })
    .nullable()
    .catch(null),
  confirmRepeat: z.literal("1").nullable().catch(null),
});

export async function submitReportAction(_prev: ReportState, form: FormData): Promise<ReportState> {
  const { token, school, coords, confirmRepeat } = envelope.parse({
    token: form.get("cf-turnstile-response"),
    school: form.get("school"),
    coords: { lat: form.get("lat"), lng: form.get("lng") },
    confirmRepeat: form.get("confirmRepeat"),
  });

  if (!(await verifyTurnstile(token))) {
    return error("Pemeriksaan keamanan gagal. Coba kirim lagi.");
  }

  const db = getDb();

  if (!(await allowHit(db, `report:ip:${await clientIpHash()}`, REPORT_IP_LIMIT))) {
    return error("Terlalu banyak percobaan, coba lagi beberapa menit lagi.");
  }

  const found = await findSchool(db, school);

  if (!found) return error("Sekolah tidak ditemukan.");
  const parsed = parseReportForm(form, todayWIB());

  if (!parsed.ok) return error(parsed.message);

  const result = await submitReport(db, parsed.report, {
    school: found,
    coords,
    deviceHash: await deviceHash(),
    ipHash: await clientIpHash(),
    confirmRepeat: confirmRepeat === "1",
  });

  if (result.kind === "duplicate") {
    return error("Kamu sudah menilai makanan tanggal ini. Untuk koreksi, tambahkan perkembangan lewat kode lacak.");
  }

  if (result.kind === "repeat_health") return { status: "repeat_health" };

  return { status: "done", kind: parsed.report.kind, code: result.code };
}
