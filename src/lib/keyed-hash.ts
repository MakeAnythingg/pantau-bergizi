import { createHmac } from "node:crypto";
import { getEnv } from "./env";

/** Output of keyedHash. Branded so a raw IP or email can't be passed where a hash is required. */
export type KeyedHash = string & { readonly __brand: "KeyedHash" };

/**
 * HMAC-SHA256 of an identifier we must not store raw (IP address, attempted login email).
 * A plain SHA of an IPv4 address is reversible by brute force; without the key, this isn't.
 */
export function keyedHash(value: string, secret: string = getEnv().IP_HASH_SECRET): KeyedHash {
  // SAFETY: an HMAC hex digest is exactly what the brand certifies.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the brand's only constructor; branding needs one cast
  return createHmac("sha256", secret).update(value).digest("hex") as KeyedHash;
}
