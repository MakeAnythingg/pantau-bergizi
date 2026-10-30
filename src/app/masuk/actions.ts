"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { login } from "@/lib/auth";
import { clientIpHash } from "@/lib/client-ip";
import { startSession } from "@/lib/session";

export type LoginState = { error?: string };

const loginSchema = z.object({ email: z.string().min(1).max(254), password: z.string().min(1).max(200) });

// Never says whether the email exists.
const ERROR = {
  invalid: "Email atau kata sandi salah",
  throttled: "Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.",
} as const;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });

  if (!parsed.success) return { error: ERROR.invalid };
  const result = await login(getDb(), parsed.data.email, parsed.data.password, await clientIpHash());

  if (!result.ok) return { error: ERROR[result.reason] };
  await startSession(result.session);

  return redirect("/dasbor");
}
