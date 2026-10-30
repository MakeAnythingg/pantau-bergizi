import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db";
import { currentSession, type Role, type Session, SESSION_TTL_SECONDS, signSession, verifySession } from "./auth";
import { getEnv } from "./env";

const SESSION_COOKIE = "pb_session";

async function getSession(): Promise<Session | null> {
  await connection(); // session expiry reads the clock, so this must render at request time
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = token ? verifySession(token, getEnv().SESSION_SECRET) : null;

  return session && currentSession(getDb(), session);
}

/** Every staff page and server action calls this first. Redirects to /masuk when not allowed. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();

  if (!session || !roles.includes(session.role)) redirect("/masuk");

  return session;
}

export async function startSession(s: Omit<Session, "exp">): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  (await cookies()).set(SESSION_COOKIE, signSession({ ...s, exp }, getEnv().SESSION_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
