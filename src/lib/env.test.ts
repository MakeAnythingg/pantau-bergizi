import { expect, test } from "bun:test";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://x/y",
  SESSION_SECRET: "a".repeat(32),
  IP_HASH_SECRET: "i".repeat(32),
  CRON_SECRET: "c".repeat(32),
  PUBLIC_BASE_URL: "https://pantau-bergizi.vercel.app",
};

test("rejects missing SESSION_SECRET", () => {
  expect(() => parseEnv({ ...base, SESSION_SECRET: undefined })).toThrow();
});

test("rejects SESSION_SECRET shorter than 32 chars", () => {
  expect(() => parseEnv({ ...base, SESSION_SECRET: "short" })).toThrow();
});

test("rejects missing or short IP_HASH_SECRET", () => {
  expect(() => parseEnv({ ...base, IP_HASH_SECRET: undefined })).toThrow();
  expect(() => parseEnv({ ...base, IP_HASH_SECRET: "short" })).toThrow();
});

test("DEMO_MODE is true only for the string 'true'", () => {
  expect(parseEnv({ ...base, DEMO_MODE: "true" }).DEMO_MODE).toBe(true);
  expect(parseEnv({ ...base, DEMO_MODE: "1" }).DEMO_MODE).toBe(false);
  expect(parseEnv(base).DEMO_MODE).toBe(false);
});

test("rejects CRON_SECRET shorter than 32 chars", () => {
  expect(() => parseEnv({ ...base, CRON_SECRET: "short" })).toThrow();
});

test("PUBLIC_BASE_URL needs an http(s) scheme and no trailing slash", () => {
  expect(() => parseEnv({ ...base, PUBLIC_BASE_URL: undefined })).toThrow();
  expect(() => parseEnv({ ...base, PUBLIC_BASE_URL: "pantau-bergizi.vercel.app" })).toThrow();
  expect(() => parseEnv({ ...base, PUBLIC_BASE_URL: "javascript:alert(1)" })).toThrow();
  expect(() => parseEnv({ ...base, PUBLIC_BASE_URL: "https://pantau-bergizi.vercel.app/" })).toThrow();
});

test("importing the db and env modules does not require env vars (Vercel build without secrets)", async () => {
  const dir = import.meta.dir;

  const proc = Bun.spawn(["bun", "-e", `await import("${dir}/../db/index.ts"); await import("${dir}/env.ts")`], {
    cwd: "/tmp", // no .env here, so Bun loads nothing
    env: { PATH: process.env.PATH ?? "" },
    stderr: "pipe",
  });

  expect(await proc.exited).toBe(0);
});
