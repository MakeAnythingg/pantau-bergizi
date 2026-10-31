import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { type KeyedHash, keyedHash } from "./keyed-hash";

const DEVICE_COOKIE = "pb_device";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Keyed hash of this browser's device cookie, setting a fresh cookie first if it has none (PRD F8). */
export async function deviceHash(): Promise<KeyedHash> {
  const jar = await cookies();
  let id = jar.get(DEVICE_COOKIE)?.value;

  if (!id || !/^[\w-]{43}$/.test(id)) {
    id = randomBytes(32).toString("base64url");
    jar.set(DEVICE_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
  }

  return keyedHash(id);
}
