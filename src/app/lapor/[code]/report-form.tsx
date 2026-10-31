"use client";

import Link from "next/link";
import { type ReactNode, type SubmitEvent, startTransition, useActionState, useState } from "react";
import { Turnstile } from "@/components/turnstile";
import { cn } from "@/lib/utils";
import { type ReportState, submitReportAction } from "./actions";

type Path = "experience" | "health";

type Role = "teacher" | "student" | "parent";

const ROLES: [Role, string][] = [
  ["teacher", "Guru/UKS"],
  ["student", "Siswa"],
  ["parent", "Orang tua"],
];

const RATINGS = [
  ["1", "😖", "Sangat kurang"],
  ["2", "🙁", "Kurang"],
  ["3", "😐", "Cukup"],
  ["4", "🙂", "Baik"],
  ["5", "😋", "Sangat baik"],
] as const;

const LEFTOVERS = [
  ["none", "Habis"],
  ["little", "Sisa sedikit"],
  ["lots", "Sisa banyak"],
] as const;

const PROBLEMS = [
  ["stale", "Basi/berbau"],
  ["foreign_object", "Benda asing"],
  ["small_portion", "Porsi kurang"],
  ["late", "Terlambat"],
  ["none", "Tidak ada masalah"],
] as const;

const SYMPTOMS = [
  ["nausea", "Mual/muntah"],
  ["diarrhea", "Diare"],
  ["dizzy", "Pusing"],
  ["other", "Lainnya"],
] as const;

const LOCATE_TIMEOUT_MS = 5000;

/** The browser's position, or null when denied, unsupported, or slower than 5 s. */
function locate(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);

      return;
    }

    const timer = setTimeout(() => {
      resolve(null);
    }, LOCATE_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
      { timeout: LOCATE_TIMEOUT_MS },
    );
  });
}

const chip =
  "flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-white px-3.5 py-2 text-[15px] font-semibold shadow-[0_0_0_1px_rgb(24_36_44/0.08)] has-checked:bg-navy has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-navy";

function Choice({
  type,
  name,
  value,
  required,
  checked,
  onChange,
  className,
  children,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  required?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn(chip, className)}>
      <input
        type={type}
        name={name}
        value={value}
        required={required}
        checked={checked}
        onChange={
          onChange &&
          ((e) => {
            onChange(e.currentTarget.checked);
          })
        }
        className="sr-only"
      />
      {children}
    </label>
  );
}

function Field({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="mt-6">
      <legend className="mb-2.5 text-[15px] font-bold">{legend}</legend>
      {children}
    </fieldset>
  );
}

type School = { code: string; name: string; sppgName: string };

export function ReportForm({
  school,
  siteKey,
  today,
  minDate,
}: {
  school: School;
  siteKey: string;
  today: string;
  minDate: string;
}) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReportAction, { status: "idle" });
  const [path, setPath] = useState<Path>("experience");
  const [role, setRole] = useState<Role | null>(null);
  const [subject, setSubject] = useState<"self" | "group">("self");
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const [locating, setLocating] = useState(false);
  const [botReady, setBotReady] = useState(false);

  if (state.status === "done") return <Success kind={state.kind} code={state.code} />;

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget, e.nativeEvent.submitter);
    setBotReady(false);
    setLocating(true);
    const coords = await locate();
    setLocating(false);
    // The token is in `form` and single-use, so ask for the next one. Only now: resetting the widget while the
    // location request is pending makes Chrome fail it (POSITION_UNAVAILABLE).
    window.turnstile?.reset();

    if (coords) {
      form.set("lat", String(coords.lat));
      form.set("lng", String(coords.lng));
    }

    startTransition(() => {
      action(form);
    });
  }

  const toggleProblem = (value: string, checked: boolean) => {
    setProblems((prev) => {
      if (!checked) return new Set([...prev].filter((p) => p !== value));

      // "Tidak ada masalah" can't be combined with a problem.
      return value === "none" ? new Set(["none"]) : new Set([...prev].filter((p) => p !== "none")).add(value);
    });
  };

  const busy = locating || pending;
  const health = path === "health";

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="pb-6">
      <input type="hidden" name="school" value={school.code} />
      <input type="hidden" name="kind" value={path} />

      <p className="text-sm font-semibold text-ink-3">Dapur: {school.sppgName}</p>
      <h1 className="font-heading text-[30px] leading-[1.05] font-bold tracking-tight">
        {health ? "Ada yang sakit setelah makan?" : school.name}
      </h1>
      {health && <p className="mt-1 text-ink-2">{school.name}</p>}

      <Field legend="Saya">
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map(([value, label]) => (
            <Choice
              key={value}
              type="radio"
              name="reporterRole"
              value={value}
              required
              checked={role === value}
              onChange={() => {
                setRole(value);

                if (value !== "teacher") setSubject("self");
              }}
            >
              {label}
            </Choice>
          ))}
        </div>
      </Field>

      <label className="mt-6 block">
        <span className="mb-2.5 block text-[15px] font-bold">Tanggal makan</span>
        <input
          type="date"
          name="consumedOn"
          required
          defaultValue={today}
          min={minDate}
          max={today}
          className="min-h-11 w-full rounded-xl bg-white px-3.5 text-[15px] shadow-[0_0_0_1px_rgb(24_36_44/0.08)]"
        />
      </label>

      {health ? (
        <>
          <Field legend="Gejala">
            <div className="grid grid-cols-2 gap-2">
              {SYMPTOMS.map(([value, label]) => (
                <Choice key={value} type="checkbox" name="symptoms" value={value}>
                  {label}
                </Choice>
              ))}
            </div>
          </Field>
          <Field legend="Yang mengalami">
            <div className="grid gap-2">
              <Choice
                type="radio"
                name="subject"
                value="self"
                required
                checked={subject === "self"}
                onChange={() => {
                  setSubject("self");
                }}
              >
                Saya / anak saya
              </Choice>
              {role === "teacher" && (
                <Choice
                  type="radio"
                  name="subject"
                  value="group"
                  checked={subject === "group"}
                  onChange={() => {
                    setSubject("group");
                  }}
                >
                  Pengamatan kelompok di sekolah
                </Choice>
              )}
            </div>
            {subject === "group" && role === "teacher" && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-semibold">Perkiraan jumlah terdampak</span>
                <input
                  type="number"
                  name="affectedCount"
                  required
                  min={1}
                  max={5000}
                  inputMode="numeric"
                  className="min-h-11 w-32 rounded-xl bg-white px-3.5 text-[15px] shadow-[0_0_0_1px_rgb(24_36_44/0.08)]"
                />
              </label>
            )}
          </Field>
        </>
      ) : (
        <>
          <Field legend="Nilai">
            <div className="grid grid-cols-5 gap-1.5">
              {RATINGS.map(([value, face, label]) => (
                <Choice key={value} type="radio" name="rating" value={value} required className="flex-col px-1 py-2">
                  <span aria-hidden="true" className="text-2xl leading-none">
                    {face}
                  </span>
                  <span className="mt-1 text-center text-[11px] leading-tight font-medium">{label}</span>
                </Choice>
              ))}
            </div>
          </Field>
          <Field legend="Seberapa habis?">
            <div className="grid grid-cols-3 gap-2">
              {LEFTOVERS.map(([value, label]) => (
                <Choice key={value} type="radio" name="leftover" value={value} required>
                  {label}
                </Choice>
              ))}
            </div>
          </Field>
          <Field legend="Ada masalah?">
            <div className="flex flex-wrap gap-2">
              {PROBLEMS.map(([value, label]) => (
                <Choice
                  key={value}
                  type="checkbox"
                  name="problems"
                  value={value}
                  checked={problems.has(value)}
                  onChange={(checked) => {
                    toggleProblem(value, checked);
                  }}
                >
                  {label}
                </Choice>
              ))}
            </div>
          </Field>
        </>
      )}

      <label className="mt-6 block">
        <span className="mb-2.5 block text-[15px] font-bold">Catatan (opsional)</span>
        <textarea
          name="note"
          maxLength={300}
          rows={3}
          className="w-full rounded-xl bg-white px-3.5 py-2.5 text-[15px] shadow-[0_0_0_1px_rgb(24_36_44/0.08)]"
        />
      </label>

      <Turnstile siteKey={siteKey} onReady={setBotReady} />

      {state.status === "error" && (
        <p role="alert" className="mt-4 rounded-xl bg-alarm-soft px-4 py-3 text-sm font-semibold text-alarm">
          {state.message}
        </p>
      )}

      {state.status === "repeat_health" ? (
        <div role="alert" className="mt-4 rounded-xl bg-caution/15 px-4 py-3 text-sm">
          <p className="font-semibold">
            Kamu sudah melapor untuk tanggal ini. Punya kode lacak? Tambahkan perkembangan di{" "}
            <Link href="/lacak" className="text-navy underline">
              /lacak
            </Link>
            .
          </p>
          <button
            type="submit"
            name="confirmRepeat"
            value="1"
            disabled={busy || !botReady}
            className="mt-3 min-h-11 w-full rounded-xl bg-navy px-4 font-bold text-white disabled:opacity-60"
          >
            Tetap kirim sebagai laporan baru
          </button>
        </div>
      ) : (
        <button
          type="submit"
          disabled={busy || !botReady}
          className={cn(
            "mt-6 min-h-12 w-full rounded-xl px-4 text-base font-bold text-white disabled:opacity-60",
            health ? "bg-alarm" : "bg-navy",
          )}
        >
          {locating ? "Memeriksa lokasi…" : pending ? "Mengirim…" : health ? "Kirim laporan" : "Kirim penilaian"}
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          setPath(health ? "experience" : "health");
        }}
        className={cn(
          "mt-6 flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left font-bold",
          health ? "bg-white text-navy" : "bg-alarm-soft text-alarm",
        )}
      >
        {health ? "← Kembali ke penilaian menu" : "⚠ Ada yang sakit setelah makan? →"}
      </button>
    </form>
  );
}

function Success({ kind, code }: { kind: Path; code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <section aria-labelledby="terkirim" className="pb-6">
      <h1 id="terkirim" className="font-heading text-[30px] leading-[1.05] font-bold tracking-tight">
        Terima kasih, laporan terkirim
      </h1>
      <div className="well mt-6 text-center">
        <p className="text-sm font-semibold text-ink-2">Kode lacak kamu</p>
        <p data-testid="tracking-code" className="mt-1 font-mono text-[32px] font-bold tracking-wider">
          {code}
        </p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
            });
          }}
          className="mt-3 min-h-11 rounded-full bg-white px-5 font-bold text-navy shadow-sm"
        >
          {copied ? "Kode disalin" : "Salin kode"}
        </button>
        <p className="mt-3 text-sm text-ink-2">
          Simpan atau screenshot kode ini. Kode hanya ditampilkan sekali dan tidak disimpan di perangkat ini.
        </p>
      </div>
      {kind === "health" && (
        <p className="mt-5 rounded-xl bg-alarm-soft px-4 py-3 text-sm font-semibold text-alarm">
          Butuh bantuan? Hubungi UKS / Puskesmas terdekat. Keadaan darurat: 119.
        </p>
      )}
      <Link
        href="/lacak"
        className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-navy px-4 font-bold text-white"
      >
        Lacak laporan
      </Link>
    </section>
  );
}
