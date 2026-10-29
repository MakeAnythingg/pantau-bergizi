import { expect, test } from "bun:test";
import { parseEnv } from "./env";

const base = {
  DATABASE_URL: "postgres://x/y",
  SESSION_SECRET: "a".repeat(32),
  CRON_SECRET: "c",
};

test("rejects missing SESSION_SECRET", () => {
  expect(() => parseEnv({ ...base, SESSION_SECRET: undefined })).toThrow();
});

test("rejects SESSION_SECRET shorter than 32 chars", () => {
  expect(() => parseEnv({ ...base, SESSION_SECRET: "short" })).toThrow();
});

test("DEMO_MODE is true only for the string 'true'", () => {
  expect(parseEnv({ ...base, DEMO_MODE: "true" }).DEMO_MODE).toBe(true);
  expect(parseEnv({ ...base, DEMO_MODE: "1" }).DEMO_MODE).toBe(false);
  expect(parseEnv(base).DEMO_MODE).toBe(false);
});
