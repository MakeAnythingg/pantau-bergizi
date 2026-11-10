"use client";

import { type ReactNode, useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { DashboardResult } from "./actions";

export function DashboardForm({
  action,
  children,
  label,
  danger,
}: {
  action: (previous: DashboardResult, form: FormData) => Promise<DashboardResult>;
  children?: ReactNode;
  label: string;
  danger?: boolean;
}) {
  const [state, submit, pending] = useActionState(action, { status: "idle" });

  return (
    <form action={submit} className="grid justify-items-start gap-2">
      {children}
      <Button type="submit" size="sm" variant={danger ? "destructive" : "outline"} disabled={pending}>
        {pending ? "Menyimpan…" : label}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      {state.status === "saved" && <output className="text-sm text-muted-foreground">Tersimpan.</output>}
    </form>
  );
}
