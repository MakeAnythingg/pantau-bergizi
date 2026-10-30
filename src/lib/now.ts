import { connection } from "next/server";

/** The current request's time. Awaits `connection()` first so the page renders per request, not at build. */
export async function requestNow(): Promise<Date> {
  await connection();

  return new Date();
}
