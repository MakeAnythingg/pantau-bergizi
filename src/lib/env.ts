import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
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
