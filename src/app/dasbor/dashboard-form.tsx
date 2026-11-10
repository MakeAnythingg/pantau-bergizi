"use client";

import { type ReactNode, useActionState, useEffect, useEffectEvent } from "react";
import { Button } from "@/components/ui/button";
import type { DashboardResult } from "./actions";

export function DashboardForm({
  action,
  children,
  label,
  danger,
  primary = false,
  cancel,
  onSaved,
}: {
  action: (previous: DashboardResult, form: FormData) => Promise<DashboardResult>;
  children?: ReactNode;
  label: string;
  danger?: boolean;
  /** The main action of its row, drawn solid. */
  primary?: boolean;
  /** Shown next to the submit button, e.g. a dialog's cancel. */
  cancel?: ReactNode;
  onSaved?: () => void;
}) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });

  const saved = useEffectEvent(() => onSaved?.());

  // Fires once per action result, so a dialog reopened after a save stays open.
  useEffect(() => {
    if (state.status === "saved") saved();
  }, [state]);

  return (
    <form action={submit} className="grid justify-items-start gap-2">
      {children}
      <div className="flex w-full flex-wrap items-center gap-2">
        <Button
          type="submit"
          size="sm"
          variant={danger ? (primary ? "danger" : "destructive") : primary ? "default" : "outline"}
          disabled={pending}
        >
          {pending ? "Menyimpan…" : label}
        </Button>
        {cancel}
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "saved" && <output className="text-sm text-muted-foreground">Tersimpan.</output>}
    </form>
  );
}
