"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { addReporterUpdate, findReportByCode, NOTE_TOO_LONG, type TrackedReport } from "@/db/reports";
import { clientIpHash } from "@/lib/client-ip";
import { allowHit } from "@/lib/rate-limit";
import { LACAK_IP_LIMIT, NOTE_MAX_CHARS } from "@/lib/thresholds";

export type LacakState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "found"; code: string; report: TrackedReport; updateError: string | null };

const NOT_FOUND: LacakState = { status: "error", message: "Kode tidak ditemukan." };
const THROTTLED: LacakState = { status: "error", message: "Terlalu banyak percobaan, coba lagi beberapa menit lagi." };

const envelope = z.object({
  code: z.string().max(40).catch(""),
  update: z.string().nullable().catch(null),
});

const updateBody = z.string().trim().min(1, "Tulis perkembangannya dulu.").max(NOTE_MAX_CHARS, NOTE_TOO_LONG);

/** Lookup (and, with `update`, a reporter update). The code only ever travels in the POST body. */
export async function lacakAction(_prev: LacakState, form: FormData): Promise<LacakState> {
  const db = getDb();

  if (!(await allowHit(db, `lacak:ip:${await clientIpHash()}`, LACAK_IP_LIMIT))) return THROTTLED;
  const { code, update } = envelope.parse({ code: form.get("code"), update: form.get("update") });
  const body = update === null ? null : updateBody.safeParse(update);

  if (body?.success && !(await addReporterUpdate(db, code, body.data))) return NOT_FOUND;
  const report = await findReportByCode(db, code);

  if (!report) return NOT_FOUND;

  // A rejected update keeps the thread on screen, with the reason next to the textarea.
  return { status: "found", code, report, updateError: body?.error?.issues[0]?.message ?? null };
}
