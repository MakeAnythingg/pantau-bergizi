import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

// prepare: false — Neon's pooled URL runs PgBouncer in transaction mode, which breaks prepared statements.
// max: 1 — each serverless instance handles one request at a time; Neon's pooler does the pooling.
export function createDb(url: string) {
  return drizzle(postgres(url, { prepare: false, max: 1 }), { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof createDb>;

export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The row from an INSERT … RETURNING of a single value. Postgres always returns it; throws if not. */
export function one<T>(rows: T[]): T {
  const [row] = rows;

  if (row === undefined) throw new Error("Expected exactly one returned row");

  return row;
}

let cached: Db | undefined;

/** The app's client, created on first use (see getEnv). */
export function getDb(): Db {
  cached ??= createDb(getEnv().DATABASE_URL);

  return cached;
}
