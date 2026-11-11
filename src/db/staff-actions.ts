import { and, eq, isNull, ne } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { todayWIB } from "@/lib/date";
import { PLATE, type Plate, PLATE_SLOT_MAX_CHARS } from "@/lib/menu";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";
import { closeEpisode, lockKitchen, syncEpisode } from "./episodes";
import { type Db, one, type Tx } from "./index";
import { episode, menu, report, response, school } from "./schema";

type Status = typeof report.$inferSelect.status;

type Forwarding = typeof episode.$inferSelect.forwarding;

type Actor = { uid: number };

type Manager = Actor & { sppgId: number | null };

export class StaffError extends Error {}

const conflict = () => new StaffError("Laporan ini sudah diubah moderator lain, muat ulang.");

function requiredText(value: string) {
  const text = value.trim();

  if (!text || text.length > NOTE_MAX_CHARS) {
    throw new StaffError(`Isi teks dengan 1–${NOTE_MAX_CHARS} karakter.`);
  }

  return text;
}

function plateText(plate: Plate): Plate {
  const trimmed = { ...plate };

  for (const { key, label, required } of PLATE) {
    const text = plate[key].trim();

    if ((required && !text) || text.length > PLATE_SLOT_MAX_CHARS) {
      throw new StaffError(`Isi ${label.toLowerCase()} dengan ${required ? 1 : 0}–${PLATE_SLOT_MAX_CHARS} karakter.`);
    }

    trimmed[key] = text;
  }

  return trimmed;
}

async function lockReport(tx: Tx, id: number, owner?: number | null) {
  const [target] = await tx
    .select({ sppgId: school.sppgId })
    .from(report)
    .innerJoin(school, eq(report.schoolId, school.id))
    .where(eq(report.id, id));

  if (!target || (owner !== undefined && target.sppgId !== owner)) {
    throw new StaffError("Laporan tidak tersedia.");
  }

  await lockKitchen(tx, target.sppgId);
  const [current] = await tx.select().from(report).where(eq(report.id, id));

  if (!current) throw conflict();

  return { current, sppgId: target.sppgId };
}

async function setReportStatus(
  tx: Tx,
  current: typeof report.$inferSelect,
  after: { status: Status; rejectReason: string | null },
  actorUserId: number,
) {
  const [updated] = await tx
    .update(report)
    .set(after)
    .where(and(eq(report.id, current.id), eq(report.status, current.status)))
    .returning({ id: report.id });

  if (!updated) throw conflict();

  await audit(tx, {
    action: "report.status_changed",
    actorUserId,
    entity: "report",
    entityId: current.id,
    before: { status: current.status, rejectReason: current.rejectReason },
    after,
  });
}

type Moderation =
  | { kind: "review" | "finish" }
  | { kind: "reject"; reason: string }
  | { kind: "merge"; targetId: number };

export async function moderateReport(db: Db, actor: Actor, id: number, seen: Status, action: Moderation) {
  await db.transaction(async (tx) => {
    const { current, sppgId } = await lockReport(tx, id);

    if (current.status !== seen || current.duplicateOf !== null) throw conflict();

    const now = new Date();

    if (action.kind === "merge") {
      const [target] = await tx
        .select({ id: report.id })
        .from(report)
        .where(
          and(
            eq(report.id, action.targetId),
            ne(report.id, id),
            eq(report.schoolId, current.schoolId),
            eq(report.kind, current.kind),
            eq(report.consumedOn, current.consumedOn),
            isNull(report.duplicateOf),
          ),
        );

      const [child] = await tx.select({ id: report.id }).from(report).where(eq(report.duplicateOf, id)).limit(1);

      if (!target || child)
        throw new StaffError("Pilih laporan induk yang sesuai dan tidak membentuk rantai duplikat.");

      const [updated] = await tx
        .update(report)
        .set({ duplicateOf: target.id })
        .where(and(eq(report.id, id), eq(report.status, seen), isNull(report.duplicateOf)))
        .returning({ id: report.id });

      if (!updated) throw conflict();

      await audit(tx, {
        action: "report.merged",
        actorUserId: actor.uid,
        entity: "report",
        entityId: id,
        before: { duplicateOf: null },
        after: { duplicateOf: target.id },
      });
      await syncEpisode(tx, sppgId, now, { kind: "merge" });

      return;
    }

    if (action.kind === "reject") {
      if (seen === "rejected") throw new StaffError("Laporan sudah ditolak.");
      const reason = requiredText(action.reason);
      await setReportStatus(tx, current, { status: "rejected", rejectReason: reason }, actor.uid);
      await syncEpisode(tx, sppgId, now, { kind: "reject", reason });

      return;
    }

    if (action.kind === "review" && seen !== "received") throw new StaffError("Laporan sudah ditinjau.");

    if (action.kind === "finish" && seen !== "reviewed" && seen !== "responded") {
      throw new StaffError("Laporan belum bisa diselesaikan.");
    }

    await setReportStatus(
      tx,
      current,
      {
        status: action.kind === "review" ? "reviewed" : "closed",
        rejectReason: null,
      },
      actor.uid,
    );
    await syncEpisode(tx, sppgId, now);
  });
}

async function lockOpenEpisode(tx: Tx, id: number, owner?: number | null) {
  const [target] = await tx.select({ sppgId: episode.sppgId }).from(episode).where(eq(episode.id, id));

  if (!target || (owner !== undefined && target.sppgId !== owner)) {
    throw new StaffError("Episode tidak tersedia.");
  }

  await lockKitchen(tx, target.sppgId);

  const [open] = await tx
    .select()
    .from(episode)
    .where(and(eq(episode.id, id), isNull(episode.closedAt)));

  if (!open) throw new StaffError("Episode ini sudah ditutup. Muat ulang.");

  return open;
}

type EpisodeAction =
  | { kind: "close"; note: string }
  | { kind: "forward"; forwarding: Forwarding; note: string; seen: Forwarding; seenNote: string };

export async function moderateEpisode(db: Db, actor: Actor, id: number, action: EpisodeAction) {
  await db.transaction(async (tx) => {
    const open = await lockOpenEpisode(tx, id);

    if (action.kind === "close") {
      await closeEpisode(tx, id, requiredText(action.note), actor.uid);

      return;
    }

    if (open.forwarding !== action.seen || (open.forwardingNote ?? "") !== action.seenNote) {
      throw new StaffError("Status penerusan sudah berubah. Muat ulang.");
    }

    const note = action.forwarding === "forwarded_by_officer" ? requiredText(action.note) : null;
    const after = { forwarding: action.forwarding, forwardingNote: note };

    if (open.forwarding === after.forwarding && open.forwardingNote === after.forwardingNote) return;

    await tx.update(episode).set(after).where(eq(episode.id, id));
    await audit(tx, {
      action: "episode.forwarding_changed",
      actorUserId: actor.uid,
      entity: "episode",
      entityId: id,
      before: { forwarding: open.forwarding, forwardingNote: open.forwardingNote },
      after,
    });
  });
}

type ReplyTarget = { kind: "report"; id: number; seen: Status } | { kind: "episode"; id: number };

export async function replyAsManager(db: Db, actor: Manager, target: ReplyTarget, message: string) {
  const body = requiredText(message);

  await db.transaction(async (tx) => {
    if (target.kind === "report") {
      const { current, sppgId } = await lockReport(tx, target.id, actor.sppgId);

      if (current.status !== target.seen || current.duplicateOf !== null) throw conflict();

      if (current.status !== "reviewed" && current.status !== "responded") {
        throw new StaffError("Laporan ini belum bisa ditanggapi.");
      }

      if (current.status === "reviewed") {
        await setReportStatus(tx, current, { status: "responded", rejectReason: null }, actor.uid);
        await syncEpisode(tx, sppgId, new Date());
      }
    } else {
      await lockOpenEpisode(tx, target.id, actor.sppgId);
    }

    const links = {
      reportId: target.kind === "report" ? target.id : null,
      episodeId: target.kind === "episode" ? target.id : null,
    };

    const reply = one(
      await tx
        .insert(response)
        .values({ ...links, body, authorKind: "sppg", authorUserId: actor.uid, createdAt: new Date() })
        .returning({ id: response.id }),
    );

    await audit(tx, {
      action: "response.created",
      actorUserId: actor.uid,
      entity: "response",
      entityId: reply.id,
      before: null,
      after: links,
    });
  });
}

export async function updateTodayMenu(
  db: Db,
  actor: Manager,
  sppgId: number,
  servedOn: string,
  name: string,
  plate: Plate,
) {
  if (actor.sppgId !== sppgId) throw new StaffError("Menu tidak tersedia.");
  const after = { name: requiredText(name), ...plateText(plate) };

  await db.transaction(async (tx) => {
    await lockKitchen(tx, sppgId);
    const now = new Date();

    if (servedOn !== todayWIB(now)) throw new StaffError("Hanya menu hari ini yang bisa diubah.");

    const [before] = await tx
      .select({
        name: menu.name,
        staple: menu.staple,
        protein: menu.protein,
        vegetable: menu.vegetable,
        fruit: menu.fruit,
        milk: menu.milk,
      })
      .from(menu)
      .where(and(eq(menu.sppgId, sppgId), eq(menu.servedOn, servedOn)));

    const set = { ...after, updatedAt: now };

    const saved = one(
      await tx
        .insert(menu)
        .values({ sppgId, servedOn, ...set })
        .onConflictDoUpdate({ target: [menu.sppgId, menu.servedOn], set })
        .returning({ id: menu.id }),
    );

    await audit(tx, {
      action: "menu.updated",
      actorUserId: actor.uid,
      entity: "menu",
      entityId: saved.id,
      before: before ?? null,
      after,
    });
  });
}
