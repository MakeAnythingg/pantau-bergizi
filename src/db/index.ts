import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// prepare: false — Neon's pooled URL runs PgBouncer in transaction mode, which breaks prepared statements.
export function createDb(url: string) {
  return drizzle(postgres(url, { prepare: false }), { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

export const db = createDb(env.DATABASE_URL);
