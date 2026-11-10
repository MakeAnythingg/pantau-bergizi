import type { StaffReport } from "@/db/staff";
import { formatDayWIB, formatTimeWIB } from "@/lib/date";
import { TEACHER_GROUP_MIN_AFFECTED } from "@/lib/thresholds";

export const ROLES = { teacher: "Guru/UKS", student: "Siswa", parent: "Orang tua" };
export const LOCATION = { inside: "Di area sekolah", outside: "Di luar area", unavailable: "Lokasi tidak tersedia" };
export const SYMPTOMS = { nausea: "Mual/muntah", diarrhea: "Diare", dizzy: "Pusing", other: "Keluhan lain" };

export const PROBLEMS = {
  stale: "Basi",
  foreign_object: "Ada benda asing",
  small_portion: "Porsi kurang",
  late: "Terlambat",
  none: "Tidak ada masalah",
};

const AUTHOR = { sppg: "Pengelola SPPG", moderator: "Moderator", reporter: "Perkembangan pelapor" };

/** A Guru/UKS group observation big enough to open Prioritas once a moderator reviews it. */
export function isTeacherGroup(item: StaffReport) {
  return (
    item.kind === "health" &&
    item.reporterRole === "teacher" &&
    item.subject === "group" &&
    (item.affectedCount ?? 0) >= TEACHER_GROUP_MIN_AFFECTED
  );
}

export function ReplyList({
  replies,
}: {
  replies: { id: number; body: string; createdAt: Date; authorKind?: keyof typeof AUTHOR }[];
}) {
  if (replies.length === 0) return null;

  return (
    <ol className="grid gap-2">
      {replies.map((reply) => (
        <li key={reply.id} className="rounded-md bg-muted p-3 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">
            {AUTHOR[reply.authorKind ?? "sppg"]} · {formatDayWIB(reply.createdAt)} {formatTimeWIB(reply.createdAt)} WIB
          </p>
          <p className="break-words whitespace-pre-wrap">{reply.body}</p>
        </li>
      ))}
    </ol>
  );
}
