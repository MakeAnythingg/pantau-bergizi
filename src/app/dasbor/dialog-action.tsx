"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant={danger ? "destructive" : "outline"} />}>
        {trigger}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-3 rounded-[28px] bg-card p-5 text-foreground sm:max-w-md">
        <div>
          <DialogTitle className="text-xl leading-tight font-extrabold">{title}</DialogTitle>
          {description && <DialogDescription className="mt-1">{description}</DialogDescription>}
        </div>
        <DashboardForm
          action={action}
          label={label}
          danger={danger}
          primary
          onSaved={() => {
            setOpen(false);
          }}
          cancel={<DialogClose render={<Button type="button" variant="ghost" size="sm" />}>Batal</DialogClose>}
        >
          {children}
        </DashboardForm>
      </DialogContent>
    </Dialog>
  );
}
