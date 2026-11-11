"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { forwardingEnum, reportStatusEnum } from "@/db/schema";
import { resetDb } from "@/db/seed";
import { moderateEpisode, moderateReport, replyAsManager, StaffError, updateTodayMenu } from "@/db/staff-actions";
import { getEnv } from "@/lib/env";
import { requireRole } from "@/lib/session";

type Seen = (typeof reportStatusEnum.enumValues)[number];

type Forwarding = (typeof forwardingEnum.enumValues)[number];

type ReportTarget = { id: number; seen: Seen };

type ModeratorCommand =
  | ({ kind: "review" | "reject" | "merge" | "finish" } & ReportTarget)
  | { kind: "close"; id: number }
  | { kind: "forward"; id: number; seen: Forwarding; seenNote: string }
  | { kind: "reset" };

type ManagerCommand =
  | ({ kind: "report" } & ReportTarget)
  | { kind: "episode"; id: number }
  | { kind: "menu"; id: number; servedOn: string };

export type DashboardResult = { status: "idle" | "saved" } | { status: "error"; message: string };

function field(form: FormData, name: string) {
  const value = z.string().safeParse(form.get(name));

  if (!value.success) throw new StaffError("Periksa kembali isian.");

  return value.data;
}

async function save(operation: () => Promise<void>): Promise<DashboardResult> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof StaffError) return { status: "error", message: error.message };
    throw error;
  }

  revalidatePath("/dasbor");
  revalidatePath("/");
  revalidatePath("/sppg/[id]", "page");
  revalidatePath("/sekolah/[code]", "page");

  return { status: "saved" };
}

export async function moderatorAction(command: ModeratorCommand, _previous: DashboardResult, form: FormData) {
  const actor = await requireRole("moderator");

  return save(async () => {
    const db = getDb();

    switch (command.kind) {
      case "review":
      case "finish":
        await moderateReport(db, actor, command.id, command.seen, { kind: command.kind });
        break;
      case "reject":
        await moderateReport(db, actor, command.id, command.seen, { kind: "reject", reason: field(form, "note") });
        break;
      case "merge": {
        const target = z.coerce.number().int().positive().max(2_147_483_647).safeParse(form.get("targetId"));

        if (!target.success) throw new StaffError("Pilih laporan induk.");
        await moderateReport(db, actor, command.id, command.seen, { kind: "merge", targetId: target.data });
        break;
      }

      case "close":
        await moderateEpisode(db, actor, command.id, { kind: "close", note: field(form, "note") });
        break;
      case "forward": {
        const forwarding = z.enum(forwardingEnum.enumValues).safeParse(form.get("forwarding"));

        if (!forwarding.success) throw new StaffError("Pilih status penerusan.");
        await moderateEpisode(db, actor, command.id, {
          kind: "forward",
          forwarding: forwarding.data,
          note: field(form, "note"),
          seen: command.seen,
          seenNote: command.seenNote,
        });
        break;
      }

      case "reset":
        if (!getEnv().DEMO_MODE || form.get("confirmation") !== "RESET") {
          throw new StaffError("Reset hanya tersedia dalam mode demo. Ketik RESET untuk konfirmasi.");
        }

        await resetDb(db, new Date(), actor.uid);
        break;
    }
  });
}

export async function managerAction(command: ManagerCommand, _previous: DashboardResult, form: FormData) {
  const actor = await requireRole("sppg_manager");

  return save(async () => {
    const db = getDb();

    if (command.kind === "menu") {
      await updateTodayMenu(db, actor, command.id, command.servedOn, field(form, "name"), {
        staple: field(form, "staple"),
        protein: field(form, "protein"),
        vegetable: field(form, "vegetable"),
        fruit: field(form, "fruit"),
        milk: field(form, "milk"),
      });

      return;
    }

    await replyAsManager(db, actor, command, field(form, "note"));
  });
}
