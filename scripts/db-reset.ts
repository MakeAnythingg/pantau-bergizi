import { db } from "@/db";
import { assertResetAllowed, resetDb } from "@/db/seed";
import { env } from "@/lib/env";

assertResetAllowed(env.DEMO_MODE, process.argv);
console.log(`Resetting ${new URL(env.DATABASE_URL).host}`);
await resetDb(db);
console.log("Done.");
await db.$client.end();
