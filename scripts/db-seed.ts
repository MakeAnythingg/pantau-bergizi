import { db } from "@/db";
import { seed } from "@/db/seed";

await seed(db);
console.log("Seeded Kota Sukamaju simulation data.");
await db.$client.end();
