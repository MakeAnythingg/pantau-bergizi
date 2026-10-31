import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  // Keys the hash of IPs and emails we must not store raw. Separate from SESSION_SECRET so either can rotate alone.
  IP_HASH_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  // Canonical site URL for QR codes and share links. Never derived from request headers, which can be spoofed.
  PUBLIC_BASE_URL: z
    .url({ protocol: /^https?$/ })
    .refine((v) => !v.endsWith("/"), "PUBLIC_BASE_URL must not end with a slash"),
  // Cloudflare Turnstile on the report form. Tests use Cloudflare's always-pass dummy keys.
  TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

let cached: Env | undefined;

/** Parsed on first use, not at import, so `next build` works without runtime secrets. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);

  return cached;
}
