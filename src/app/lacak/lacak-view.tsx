"use client";

import { WarningIcon } from "@phosphor-icons/react";
import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TrackedReport } from "@/db/reports";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";
import { useFieldErrors } from "@/lib/use-field-errors";
import { type LacakState, lacakAction } from "./actions";

const STATUS: Record<TrackedReport["status"], string> = {
  received: "Diterima, menunggu tinjauan moderator",
  reviewed: "Sudah ditinjau moderator",
  responded: "Sudah ditanggapi",
  closed: "Selesai",
  rejected: "Ditolak",
};

const AUTHOR: Record<TrackedReport["responses"][number]["authorKind"], string> = {
  sppg: "Tanggapan pengelola",
  moderator: "Moderator",
  reporter: "Perkembangan dari kamu",
};

const when = (d: Date) =>
  d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const mealDay = (day: string) =>
  new Date(`${day}T12:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long" });

export function LacakView() {
  const [state, action, pending] = useActionState<LacakState, FormData>(lacakAction, { status: "idle" });
  const codeId = useId();
  const { errors, formProps } = useFieldErrors();

  return (
    <>
      <form action={action} {...formProps} className="mt-6">
        <Field data-invalid={errors.code !== undefined}>
          <FieldLabel htmlFor={codeId}>Kode lacak</FieldLabel>
          <Input
            id={codeId}
            name="code"
            required
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXXX-XXXXX"
            className="h-12 bg-card font-mono text-lg uppercase"
            aria-invalid={errors.code !== undefined}
          />
          <FieldError>{errors.code}</FieldError>
        </Field>
        <Button type="submit" disabled={pending} className="mt-3 h-12 w-full text-base font-bold">
          {pending ? "Mencari…" : "Lacak"}
        </Button>
      </form>

      {state.status === "error" && (
        <Alert variant="destructive" className="mt-4">
          <WarningIcon aria-hidden="true" />
          <AlertDescription className="font-semibold text-destructive">{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "found" && <Thread state={state} action={action} pending={pending} />}
    </>
  );
}

function Thread({
  state: { code, report, updateError },
  action,
  pending,
}: {
  state: Extract<LacakState, { status: "found" }>;
  action: (form: FormData) => void;
  pending: boolean;
}) {
  const updateId = useId();
  const { errors, formProps } = useFieldErrors();
  const error = errors.update ?? updateError;

  return (
    <section aria-label="Laporan kamu" className="mt-6">
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            {report.kind === "health" ? "Keluhan kesehatan" : "Penilaian menu"} · {report.schoolName}
          </p>
          <p className="text-sm text-muted-foreground">Tanggal makan {mealDay(report.consumedOn)}</p>
          <CardTitle className="mt-2">
            <Badge variant={report.status === "rejected" ? "destructive" : "secondary"} className="h-auto text-sm">
              {STATUS[report.status]}
            </Badge>
          </CardTitle>
          {report.status === "rejected" && report.rejectReason && (
            <p className="text-sm text-muted-foreground">Alasan: {report.rejectReason}</p>
          )}
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2.5">
            {report.responses.map((r) => (
              <li key={r.id} className="rounded-lg bg-muted px-3.5 py-2.5 text-sm">
                <b className="block text-xs text-muted-foreground">
                  {AUTHOR[r.authorKind]}, {when(r.createdAt)}
                </b>
                {r.body}
              </li>
            ))}
          </ol>
          {report.responses.length === 0 && <p className="text-sm text-muted-foreground">Belum ada tanggapan.</p>}

          <form action={action} {...formProps} className="mt-5">
            <input type="hidden" name="code" value={code} />
            <Field data-invalid={error !== null}>
              <FieldLabel htmlFor={updateId}>Tambahkan perkembangan</FieldLabel>
              <Textarea
                id={updateId}
                name="update"
                required
                maxLength={NOTE_MAX_CHARS}
                rows={3}
                aria-invalid={error !== null}
              />
              <FieldDescription>
                Hanya terlihat oleh kamu, moderator, dan pengelola dapur. Tidak tampil di halaman publik.
              </FieldDescription>
              <FieldError>{error}</FieldError>
            </Field>
            <Button type="submit" disabled={pending} className="mt-3 h-12 w-full text-base font-bold">
              Kirim perkembangan
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
