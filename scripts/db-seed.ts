import { getDb } from "@/db";
import { seed } from "@/db/seed";
import { getEnv } from "@/lib/env";

// Seed creates demo accounts with a public password (PRD F7), so it only runs in the demo environment.
if (!getEnv().DEMO_MODE) throw new Error("Refusing to seed: DEMO_MODE is not 'true'.");
const db = getDb();
await seed(db);
console.log("Seeded Kota Sukamaju simulation data.");
await db.$client.end();
