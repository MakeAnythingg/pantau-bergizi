import { db } from "@/db";
import { seed } from "@/db/seed";
import { env } from "@/lib/env";

// Seed creates demo accounts with a public password (PRD F7), so it only runs in the demo environment.
if (!env.DEMO_MODE) throw new Error("Refusing to seed: DEMO_MODE is not 'true'.");
await seed(db);
console.log("Seeded Kota Sukamaju simulation data.");
await db.$client.end();
