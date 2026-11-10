"use client";

import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { DashboardResult } from "./actions";
import { DashboardForm } from "./dashboard-form";

/** A button that opens one dashboard form in a modal, so lists keep their shape. Closes itself once saved. */
export function DialogAction({
  trigger,
  title,
  description,
  action,
  label,
  danger = false,
  children,
}: {
  trigger: string;
  title: string;
  description?: string;
  action: (previous: DashboardResult, form: FormData) => Promise<DashboardResult>;
  label: string;
  danger?: boolean;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={danger ? "destructive" : "outline"}
        onClick={() => {
          dialog.current?.showModal();
        }}
      >
        {trigger}
      </Button>
      <dialog
        ref={dialog}
        aria-label={title}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[28px] bg-card p-0 text-foreground shadow-xl backdrop:bg-ink/30"
      >
        <div className="grid gap-3 p-5">
          <div>
            <h2 className="font-heading text-xl font-extrabold">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <DashboardForm
            action={action}
            label={label}
            danger={danger}
            primary
            onSaved={() => {
              dialog.current?.close();
            }}
            cancel={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  dialog.current?.close();
                }}
              >
                Batal
              </Button>
            }
          >
            {children}
          </DashboardForm>
        </div>
      </dialog>
    </>
  );
}
