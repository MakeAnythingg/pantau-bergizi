"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { authenticate } from "@/lib/auth";
import { startSession } from "@/lib/session";

export type LoginState = { error?: string };

const loginSchema = z.object({ email: z.string().min(1).max(254), password: z.string().min(1).max(200) });

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  const session = parsed.success ? await authenticate(getDb(), parsed.data.email, parsed.data.password) : null;
  if (!session) return { error: "Email atau kata sandi salah" };
  await startSession(session);
  redirect("/dasbor");
}

