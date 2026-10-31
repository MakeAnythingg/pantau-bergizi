import { z } from "zod";
import { getEnv } from "./env";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

const siteverify = z.object({ success: z.boolean() });

/** Server-side Turnstile check. Any failure (bad token, network, timeout) counts as not verified. */
export async function verifyTurnstile(token: string, secret: string = getEnv().TURNSTILE_SECRET_KEY): Promise<boolean> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return false;

  try {
    const res = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });

    const body = siteverify.safeParse(await res.json());

    return body.success && body.data.success;
  } catch {
    return false;
  }
}
