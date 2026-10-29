import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { type Role, type Session, SESSION_TTL_SECONDS, signSession, verifySession } from "./auth";
import { env } from "./env";

export const SESSION_COOKIE = "pb_session";

export async function getSession(): Promise<Session | null> {
  await connection(); // session expiry reads the clock, so this must render at request time
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token, env.SESSION_SECRET) : null;
}

/** Every staff page and server action calls this first. Redirects to /masuk when not allowed. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) redirect("/masuk");
  return session;
}

export async function startSession(s: Omit<Session, "exp">): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  (await cookies()).set(SESSION_COOKIE, signSession({ ...s, exp }, env.SESSION_SECRET), {
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
