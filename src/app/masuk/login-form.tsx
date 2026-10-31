"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldErrors } from "@/lib/use-field-errors";
import { type LoginState, loginAction } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const { errors, formProps } = useFieldErrors();

  return (
    <form action={formAction} {...formProps} className="flex flex-col gap-4">
      <Field data-invalid={errors.email !== undefined}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={errors.email !== undefined}
        />
        <FieldError>{errors.email}</FieldError>
      </Field>
      <Field data-invalid={errors.password !== undefined}>
        <FieldLabel htmlFor="password">Kata sandi</FieldLabel>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={errors.password !== undefined}
        />
        <FieldError>{errors.password}</FieldError>
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
