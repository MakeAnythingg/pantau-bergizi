"use client";

import {
  CalendarBlankIcon,
  SmileyIcon,
  SmileyMehIcon,
  SmileySadIcon,
  SmileyWinkIcon,
  SmileyXEyesIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, type SubmitEvent, startTransition, useActionState, useId, useState } from "react";
import { id as idLocale } from "react-day-picker/locale";
import { Turnstile } from "@/components/turnstile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";
import { cn } from "@/lib/utils";
import { type ReportState, submitReportAction } from "./actions";

type Path = "experience" | "health";

type Role = "teacher" | "student" | "parent";

type Options<V extends string> = readonly (readonly [V, ReactNode])[];

const ROLES: Options<Role> = [
  ["teacher", "Guru/UKS"],
  ["student", "Siswa"],
  ["parent", "Orang tua"],
];

const RATINGS = [
  ["1", SmileyXEyesIcon, "Sangat kurang"],
  ["2", SmileySadIcon, "Kurang"],
  ["3", SmileyMehIcon, "Cukup"],
  ["4", SmileyIcon, "Baik"],
  ["5", SmileyWinkIcon, "Sangat baik"],
] as const;

const LEFTOVERS: Options<string> = [
  ["none", "Habis"],
  ["little", "Sisa sedikit"],
  ["lots", "Sisa banyak"],
];

const PROBLEMS: Options<string> = [
  ["stale", "Basi/berbau"],
  ["foreign_object", "Benda asing"],
  ["small_portion", "Porsi kurang"],
  ["late", "Terlambat"],
  ["none", "Tidak ada masalah"],
];

const SYMPTOMS: Options<string> = [
  ["nausea", "Mual/muntah"],
  ["diarrhea", "Diare"],
  ["dizzy", "Pusing"],
  ["other", "Lainnya"],
];

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

// The radio or checkbox is an invisible overlay on its card, so it stays focusable without taking layout space.
const overlay = "pointer-events-none absolute inset-0 size-full rounded-lg opacity-0";

// Choice cards: white on the grey page, full navy when picked.
const card =
  "relative bg-card has-data-checked:border-primary has-data-checked:bg-primary has-data-checked:text-primary-foreground";

/**
 * One-of-N choice cards. Controlled (value from React state, null = none picked) and submitted through one hidden
 * input: Base UI doesn't mark a pre-selected controlled radio as checked for form data. No native `required`: the
 * server answers a missing pick with a clear message.
 */
function Choices<V extends string>({
  legend,
  name,
  options,
  value,
  onValueChange,
  className,
}: {
  legend: string;
  name: string;
  options: Options<V>;
  value: V | null;
  onValueChange: (value: V) => void;
  className?: string | undefined;
}) {
  const base = useId();

  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      {value !== null && <input type="hidden" name={name} value={value} />}
      <RadioGroup<V | null>
        value={value}
        onValueChange={(v) => {
          if (v !== null) onValueChange(v);
        }}
        className={className}
      >
        {options.map(([v, label]) => (
          <FieldLabel key={v} htmlFor={`${base}-${v}`} className={card}>
            <Field orientation="horizontal" className="min-h-11 justify-center">
              <RadioGroupItem value={v} id={`${base}-${v}`} className={overlay} />
              <FieldTitle className="justify-center text-center text-[15px]">{label}</FieldTitle>
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}

/** Any-of-N choice cards; each checked one submits `name=value`. */
function Checks({
  legend,
  name,
  options,
  checked,
  onToggle,
  className,
}: {
  legend: string;
  name: string;
  options: Options<string>;
  checked?: ReadonlySet<string> | undefined;
  onToggle?: ((value: string, checked: boolean) => void) | undefined;
  className?: string | undefined;
}) {
  const base = useId();

  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <div className={className}>
        {options.map(([v, label]) => (
          <FieldLabel key={v} htmlFor={`${base}-${v}`} className={card}>
            <Field orientation="horizontal" className="min-h-11 justify-center">
              <Checkbox
                id={`${base}-${v}`}
                name={name}
                value={v}
                className={overlay}
                checked={checked?.has(v)}
                onCheckedChange={
                  onToggle &&
                  ((c) => {
                    onToggle(v, c);
                  })
                }
              />
              <FieldTitle className="text-[15px]">{label}</FieldTitle>
            </Field>
          </FieldLabel>
        ))}
      </div>
    </FieldSet>
  );
}

/** "YYYY-MM-DD" ↔ a local Date at midnight, which is what the calendar works in. */
const toDate = (day: string) => new Date(`${day}T00:00:00`);

const toDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const longDay = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long" });

/** Meal-date picker, limited to the backdate window. Submits `consumedOn` as YYYY-MM-DD. */
function MealDate({ today, minDate }: { today: string; minDate: string }) {
  const [day, setDay] = useState(today);
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const chosenId = useId();

  return (
    <Field>
      <FieldLabel htmlFor={triggerId}>Tanggal makan</FieldLabel>
      <input type="hidden" name="consumedOn" value={day} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={triggerId}
          aria-describedby={chosenId}
          render={<Button variant="outline" className="h-11 w-full justify-start bg-card text-[15px] font-normal" />}
        >
          <CalendarBlankIcon aria-hidden="true" />
          <span id={chosenId}>
            {day === today ? "Hari ini, " : ""}
            {longDay.format(toDate(day))}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={idLocale}
            selected={toDate(day)}
            defaultMonth={toDate(day)}
            disabled={[{ before: toDate(minDate) }, { after: toDate(today) }]}
            onSelect={(d) => {
              if (!d) return;
              setDay(toDay(d));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
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
  const [leftover, setLeftover] = useState<string | null>(null);
  const [subject, setSubject] = useState<"self" | "group">("self");
  const [problems, setProblems] = useState<ReadonlySet<string>>(new Set());
  const [locating, setLocating] = useState(false);
  const [botReady, setBotReady] = useState(false);
  const countId = useId();
  const noteId = useId();

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
  const groupAllowed = role === "teacher";

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="pb-6">
      <input type="hidden" name="school" value={school.code} />
      <input type="hidden" name="kind" value={path} />

      <p className="text-sm font-semibold text-ink-3">Dapur: {school.sppgName}</p>
      <h1 className="font-heading text-[30px] leading-[1.05] font-bold tracking-tight">
        {health ? "Ada yang sakit setelah makan?" : school.name}
      </h1>
      {health && <p className="mt-1 text-ink-2">{school.name}</p>}

      <FieldGroup className="mt-6 gap-6">
        <Choices
          legend="Saya"
          name="reporterRole"
          options={ROLES}
          value={role}
          onValueChange={(r) => {
            setRole(r);

            if (r !== "teacher") setSubject("self");
          }}
          className="grid-cols-3"
        />

        <MealDate today={today} minDate={minDate} />

        {health ? (
          <>
            <Checks legend="Gejala" name="symptoms" options={SYMPTOMS} className="grid grid-cols-2 gap-2" />
            <Choices
              legend="Yang mengalami"
              name="subject"
              options={
                groupAllowed
                  ? [
                      ["self", "Saya / anak saya"],
                      ["group", "Pengamatan kelompok di sekolah"],
                    ]
                  : [["self", "Saya / anak saya"]]
              }
              value={subject}
              onValueChange={setSubject}
            />
            {subject === "group" && groupAllowed && (
              <Field>
                <FieldLabel htmlFor={countId}>Perkiraan jumlah terdampak</FieldLabel>
                <Input
                  id={countId}
                  type="number"
                  name="affectedCount"
                  required
                  min={1}
                  max={5000}
                  inputMode="numeric"
                  className="h-11 w-32 bg-card text-[15px]"
                />
              </Field>
            )}
          </>
        ) : (
          <>
            <FieldSet>
              <FieldLegend variant="label">Nilai</FieldLegend>
              <RadioGroup name="rating" className="grid-cols-5 gap-1.5">
                {RATINGS.map(([value, Face, label]) => (
                  <FieldLabel key={value} htmlFor={`rating-${value}`} className={card}>
                    <Field className="items-center gap-1 px-0.5 py-2 text-center">
                      <RadioGroupItem value={value} id={`rating-${value}`} className={overlay} />
                      <Face size={28} weight="duotone" aria-hidden="true" />
                      <FieldTitle className="justify-center text-[11px] leading-tight">{label}</FieldTitle>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
            <Choices
              legend="Seberapa habis?"
              name="leftover"
              options={LEFTOVERS}
              value={leftover}
              onValueChange={setLeftover}
              className="grid-cols-3"
            />
            <Checks
              legend="Ada masalah?"
              name="problems"
              options={PROBLEMS}
              checked={problems}
              onToggle={toggleProblem}
              className="flex flex-wrap gap-2 *:w-auto"
            />
          </>
        )}

        <Field>
          <FieldLabel htmlFor={noteId}>Catatan (opsional)</FieldLabel>
          <Textarea id={noteId} name="note" maxLength={NOTE_MAX_CHARS} rows={3} className="bg-card text-[15px]" />
        </Field>
      </FieldGroup>

      <Turnstile siteKey={siteKey} onReady={setBotReady} />

      {state.status === "error" && (
        <Alert variant="destructive" className="mt-4">
          <WarningIcon aria-hidden="true" />
          <AlertDescription className="font-semibold text-destructive">{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "repeat_health" ? (
        <Alert className="mt-4">
          <WarningIcon aria-hidden="true" />
          <AlertTitle>Kamu sudah melapor untuk tanggal ini.</AlertTitle>
          <AlertDescription>
            Punya kode lacak? Tambahkan perkembangan di <Link href="/lacak">/lacak</Link>.
            <Button
              type="submit"
              name="confirmRepeat"
              value="1"
              disabled={busy || !botReady}
              className="mt-3 h-11 w-full text-[15px]"
            >
              Tetap kirim sebagai laporan baru
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Button
          type="submit"
          disabled={busy || !botReady}
          variant={health ? "danger" : "default"}
          className="mt-6 h-12 w-full text-base font-bold"
        >
          {locating ? "Memeriksa lokasi…" : pending ? "Mengirim…" : health ? "Kirim laporan" : "Kirim penilaian"}
        </Button>
      )}

      <Button
        type="button"
        variant={health ? "outline" : "destructive"}
        onClick={() => {
          setPath(health ? "experience" : "health");
        }}
        className={cn("mt-6 h-12 w-full justify-between text-[15px] font-bold", health && "bg-card text-primary")}
      >
        {health ? "← Kembali ke penilaian menu" : "⚠ Ada yang sakit setelah makan? →"}
      </Button>
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
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
            });
          }}
          className="mt-3 h-11 rounded-full bg-card px-5 text-[15px] font-bold text-primary"
        >
          {copied ? "Kode disalin" : "Salin kode"}
        </Button>
        <p className="mt-3 text-sm text-ink-2">
          Simpan atau screenshot kode ini. Kode hanya ditampilkan sekali dan tidak disimpan di perangkat ini.
        </p>
      </div>
      {kind === "health" && (
        <Alert variant="destructive" className="mt-5 bg-alarm-soft">
          <WarningIcon aria-hidden="true" />
          <AlertTitle>Butuh bantuan?</AlertTitle>
          <AlertDescription className="text-destructive">
            Hubungi UKS / Puskesmas terdekat. Keadaan darurat: 119.
          </AlertDescription>
        </Alert>
      )}
      <Link href="/lacak" className={cn(buttonVariants(), "mt-5 h-12 w-full text-base font-bold")}>
        Lacak laporan
      </Link>
    </section>
  );
}
