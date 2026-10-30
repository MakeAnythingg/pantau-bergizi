import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Db } from "./index";

export { truncateAll } from "./seed";

let ready: Promise<Db> | undefined;

/** Test-only: a client for TEST_DATABASE_URL, migrated once per test run. */
export function getTestDb(): Promise<Db> {
  ready ??= (async () => {
    const url = process.env.TEST_DATABASE_URL;

    if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.test)");
    const db = createDb(url);
    await migrate(db, { migrationsFolder: "drizzle" });

    return db;
  })();

  return ready;
}
