import { and, asc, desc, eq, exists, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { formatDayWIB, formatTimeWIB } from "@/lib/date";
import { counts, priorityEvidence, type Signal } from "@/lib/signal";
import { NOTE_MAX_CHARS, RESPONSE_OVERDUE_HOURS } from "@/lib/thresholds";
import { type Db, type DbOrTx, one, type Tx } from "./index";
import { episode, report, response, school } from "./schema";
import { feedsSignal, reportFields, windowStart } from "./signal-reports";

type Episode = typeof episode.$inferSelect;

/** Acquire before changing any report or episode for this kitchen. Released at commit or rollback. */
export async function lockKitchen(tx: Tx, sppgId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(1, ${sppgId}::integer)`);
}

function attachedReports(db: DbOrTx, ids: number[]) {
  return db
    .select({ ...reportFields, rejectReason: report.rejectReason })
    .from(report)
    .innerJoin(school, eq(report.schoolId, school.id))
    .where(inArray(report.episodeId, ids))
    .orderBy(asc(report.receivedAt), asc(report.id));
}

async function attach(tx: Tx, episodeId: number, rows: { id: number }[]) {
  if (rows.length > 0) {
    await tx
      .update(report)
      .set({ episodeId })
      .where(
        inArray(
          report.id,
          rows.map((r) => r.id),
        ),
      );
  }
}

type EvidenceChange = { kind: "reject"; reason: string } | { kind: "merge" };

async function eligibleReports(tx: Tx, sppgId: number, now: Date) {
  const recent = await tx
    .select(reportFields)
    .from(report)
    .innerJoin(school, eq(report.schoolId, school.id))
    .where(
      and(
        eq(school.sppgId, sppgId),
        eq(report.kind, "health"),
        isNull(report.episodeId),
        gte(report.receivedAt, windowStart(now)),
      ),
    )
    .orderBy(asc(report.receivedAt), asc(report.id));

  return recent.filter(feedsSignal(now)).filter(counts);
}

/** Recompute after a write. The caller must already hold the kitchen lock. */
export async function syncEpisode(tx: Tx, sppgId: number, now: Date, change?: EvidenceChange) {
  const [open] = await tx
    .select()
    .from(episode)
    .where(and(eq(episode.sppgId, sppgId), isNull(episode.closedAt)));

  const eligible = await eligibleReports(tx, sppgId, now);

  if (open) {
    await attach(tx, open.id, eligible);
    const attached = await attachedReports(tx, [open.id]);

    if (priorityEvidence(attached)) return;

    const rejected = attached.findLast((r) => r.status === "rejected");

    const reason =
      change?.kind === "reject"
        ? `laporan ditolak — ${change.reason}`
        : change?.kind === "merge" || (!rejected && attached.some((r) => r.duplicateOf !== null))
          ? "laporan digabung sebagai duplikat"
          : rejected?.rejectReason
            ? `laporan ditolak — ${rejected.rejectReason}`
            : "laporan yang memenuhi syarat Prioritas tidak lagi cukup";

    await recordClose(tx, open, `Ditutup otomatis: ${reason}`, null, now);

    return;
  }

  const evidence = priorityEvidence(eligible);

  if (!evidence) return;

  const opened = one(
    await tx
      .insert(episode)
      .values({ sppgId, rule: evidence.rule, firstDetectedAt: now })
      .returning({ id: episode.id }),
  );

  await attach(tx, opened.id, evidence.reports);
}

async function recordClose(tx: Tx, open: Episode, note: string, actorUserId: number | null, now: Date) {
  const after = { closedAt: now, closedNote: note, closedByUserId: actorUserId };

  const [updated] = await tx
    .update(episode)
    .set(after)
    .where(and(eq(episode.id, open.id), isNull(episode.closedAt)))
    .returning({ id: episode.id });

  if (!updated) throw new Error("Episode ini sudah ditutup. Muat ulang.");

  await audit(tx, {
    action: "episode.closed",
    actorUserId,
    entity: "episode",
    entityId: open.id,
    before: { closedAt: open.closedAt, closedNote: open.closedNote, closedByUserId: open.closedByUserId },
    after,
  });
}

/** The caller authorizes the moderator. This function takes the kitchen lock before changing the episode. */
export async function closeEpisode(tx: Tx, episodeId: number, note: string, actorUserId: number, now?: Date) {
  const trimmed = note.trim();

  if (trimmed.length === 0 || trimmed.length > NOTE_MAX_CHARS) {
    throw new Error(`Catatan penutupan wajib diisi, maksimal ${NOTE_MAX_CHARS} karakter.`);
  }

  const [open] = await tx.select().from(episode).where(eq(episode.id, episodeId));

  if (!open) throw new Error("Episode tidak ditemukan.");

  await lockKitchen(tx, open.sppgId);
  const at = now ?? new Date();
  await recordClose(tx, open, trimmed, actorUserId, at);
  // Any eligible health reports still waiting to be attached belong to this episode.
  await attach(tx, open.id, await eligibleReports(tx, open.sppgId, at));
}

export const episodeTime = (at: Date) => `${formatDayWIB(at)} ${formatTimeWIB(at)} WIB`;

export async function getOpenEpisodes(db: Db, now: Date, kitchens?: number | number[]) {
  const scope = Array.isArray(kitchens)
    ? inArray(episode.sppgId, kitchens)
    : kitchens === undefined
      ? undefined
      : eq(episode.sppgId, kitchens);

  const hasReply = db
    .select({ id: response.id })
    .from(response)
    .where(and(eq(response.episodeId, episode.id), eq(response.authorKind, "sppg")));

  const open = await db
    .select({ episode, answered: sql<boolean>`${exists(hasReply)}` })
    .from(episode)
    .where(and(isNull(episode.closedAt), scope));

  if (open.length === 0) return [];

  const attached = await attachedReports(
    db,
    open.map(({ episode: e }) => e.id),
  );

  const evidenceByEpisode = Map.groupBy(attached.filter(counts), (r) => r.episodeId);

  return open.map(({ episode: e, answered }) => {
    const evidence = evidenceByEpisode.get(e.id) ?? [];
    const priority = priorityEvidence(evidence, e.rule) ?? priorityEvidence(evidence);

    const label =
      e.rule === "auto_multi_school" && evidence.some((r) => r.status === "received")
        ? "Otomatis, belum ditinjau moderator"
        : "Ditinjau moderator";

    const detected = `Terdeteksi ${episodeTime(e.firstDetectedAt)}`;

    const signal: Signal = {
      status: "priority",
      reason: priority ? `${detected} · ${priority.reason("sejak terdeteksi")}` : detected,
      label,
    };

    const hours = (now.getTime() - e.firstDetectedAt.getTime()) / 3_600_000;

    return { ...e, signal, overdueHours: !answered && hours > RESPONSE_OVERDUE_HOURS ? Math.floor(hours) : null };
  });
}

export async function getEpisodeHistory(db: Db, sppgId: number) {
  const firstReply = db
    .select({ createdAt: response.createdAt })
    .from(response)
    .where(and(eq(response.episodeId, episode.id), eq(response.authorKind, "sppg")))
    .orderBy(asc(response.createdAt))
    .limit(1)
    .as("first_reply");

  return db
    .select({
      id: episode.id,
      firstDetectedAt: episode.firstDetectedAt,
      closedAt: sql<Date>`${episode.closedAt}`.mapWith(episode.closedAt),
      closedNote: episode.closedNote,
      firstResponseAt: firstReply.createdAt,
    })
    .from(episode)
    .leftJoinLateral(firstReply, sql`true`)
    .where(and(eq(episode.sppgId, sppgId), isNotNull(episode.closedAt)))
    .orderBy(desc(episode.closedAt), desc(episode.id))
    .limit(5);
}

export function getEpisodeReplies(db: Db, episodeId: number) {
  return db
    .select({ id: response.id, body: response.body, createdAt: response.createdAt })
    .from(response)
    .where(and(eq(response.episodeId, episodeId), eq(response.authorKind, "sppg")))
    .orderBy(asc(response.createdAt), asc(response.id));
}
