import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { StaffReport } from "@/db/staff";
import { formatDayWIB, formatTimeWIB, todayWIB, wibTime } from "@/lib/date";
import { TEACHER_GROUP_MIN_AFFECTED } from "@/lib/thresholds";

const ROLES = { teacher: "Guru/UKS", student: "Siswa", parent: "Orang tua" };
const LOCATION = { inside: "Di area sekolah", outside: "Di luar area", unavailable: "Lokasi tidak tersedia" };
const SYMPTOMS = { nausea: "Mual/muntah", diarrhea: "Diare", dizzy: "Pusing", other: "Keluhan lain" };

const PROBLEMS = {
  stale: "Basi",
  foreign_object: "Ada benda asing",
  small_portion: "Porsi kurang",
  late: "Terlambat",
  none: "Tidak ada masalah",
};

const STATUS = {
  received: "Diterima",
  reviewed: "Ditinjau",
  responded: "Ditanggapi",
  closed: "Selesai",
  rejected: "Ditolak",
};

const AUTHOR = { sppg: "Pengelola SPPG", moderator: "Moderator", reporter: "Perkembangan pelapor" };

export function ReportCard({
  item,
  now,
  children,
  flags,
  reviewTimer = false,
}: {
  item: StaffReport;
  now: Date;
  children?: ReactNode;
  flags?: { surge: boolean; repeated: boolean };
  reviewTimer?: boolean;
}) {
  const problems =
    item.kind === "health"
      ? item.symptoms.map((symptom) => SYMPTOMS[symptom])
      : item.problems.map((problem) => PROBLEMS[problem]);

  const teacherGroup =
    item.kind === "health" &&
    item.reporterRole === "teacher" &&
    item.subject === "group" &&
    (item.affectedCount ?? 0) >= TEACHER_GROUP_MIN_AFFECTED;

  const minutes = Math.max(0, Math.floor((now.getTime() - item.receivedAt.getTime()) / 60_000));

  return (
    <article className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">
          {item.schoolName} · #{item.id}
        </h3>
        <Badge variant="secondary">{STATUS[item.status]}</Badge>
        {item.duplicateOf !== null && <Badge variant="outline">Duplikat #{item.duplicateOf}</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        {item.kitchenName} · {ROLES[item.reporterRole]} ·{" "}
        {item.kind === "health" ? "Keluhan kesehatan" : "Penilaian menu"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Badge variant={item.consumedOn < todayWIB(now) ? "secondary" : "outline"}>
          Makan {formatDayWIB(wibTime(item.consumedOn))}
        </Badge>
        <Badge variant={item.locationCheck === "outside" ? "destructive" : "outline"}>
          {LOCATION[item.locationCheck]}
        </Badge>
        {reviewTimer && teacherGroup && <Badge variant="secondary">Kelompok Guru/UKS · {minutes} mnt</Badge>}
        {flags?.surge && <Badge variant="secondary">Lonjakan IP</Badge>}
        {flags?.repeated && <Badge variant="secondary">Perangkat berulang</Badge>}
      </div>
      {problems.length > 0 && <p className="text-sm">{problems.join(" · ")}</p>}
      {item.affectedCount !== null && <p className="text-sm">{item.affectedCount} terdampak</p>}
      {item.note && <p className="break-words whitespace-pre-wrap text-sm">{item.note}</p>}
      {item.rejectReason && <p className="break-words text-sm">Alasan penolakan · {item.rejectReason}</p>}
      <ReplyList replies={item.thread} />
      {children}
    </article>
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
