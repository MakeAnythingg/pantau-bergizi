import { defineConfig, devices } from "@playwright/test";

// E2E runs the production build against its own database, migrated and reset once per run.
// Every var is passed explicitly with dummy secrets; only the DB URL can be overridden (CI sets E2E_DATABASE_URL).
const PORT = 3100;

const env = {
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgres://localhost:5432/pantau_bergizi_e2e",
  SESSION_SECRET: "e2e-session-e2e-session-e2e-session-00",
  IP_HASH_SECRET: "e2e-iphash-e2e-iphash-e2e-iphash-0000",
  CRON_SECRET: "e2e-cron-e2e-cron-e2e-cron-e2e-cron-00",
  DEMO_MODE: "true",
  PUBLIC_BASE_URL: `http://localhost:${PORT}`,
  // Cloudflare's documented always-pass dummy keys (invisible widget).
  TURNSTILE_SITE_KEY: "1x00000000000000000000BB",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
};

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts", // not *.spec.ts, which `bun test` would also pick up
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run db:migrate && bun run db:reset --yes && bun run build && bun start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    env,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
