import { defineConfig } from "drizzle-kit";

// Migrations go over Neon's direct connection when available (the Vercel–Neon integration sets it).
// `generate`/`check` never connect, so a missing URL only fails `migrate` (at connect time).
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url },
});
