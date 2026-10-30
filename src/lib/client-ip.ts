import { headers } from "next/headers";
import { type KeyedHash, keyedHash } from "./keyed-hash";

/**
 * Keyed hash of the caller's IP. On Vercel, `x-real-ip` and `x-forwarded-for` are set by the edge and can't be
 * spoofed by the client; without a proxy (local/offline backup) every request falls into one "unknown" bucket.
 */
export async function clientIpHash(): Promise<KeyedHash> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  return keyedHash(ip);
}
