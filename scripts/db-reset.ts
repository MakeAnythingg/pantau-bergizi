import { getDb } from "@/db";
import { assertResetAllowed, resetDb } from "@/db/seed";
import { getEnv } from "@/lib/env";

assertResetAllowed(getEnv().DEMO_MODE, process.argv);

console.log(`Resetting ${new URL(getEnv().DATABASE_URL).host}`);

const db = getDb();

await resetDb(db);

console.log("Done.");

await db.$client.end();
