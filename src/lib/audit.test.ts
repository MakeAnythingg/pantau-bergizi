import { expect, test } from "bun:test";
import { count, eq, sql } from "drizzle-orm";
import { auditLog } from "@/db/schema";
import { resetDb } from "@/db/seed";
import { getTestDb } from "@/db/test-db";
import { audit, type AuditEntry } from "./audit";

const resets = async () => {
  const [row] = await (
    await getTestDb()
  )
    .select({ n: count() })
    .from(auditLog)
    .where(eq(auditLog.action, "demo.reset"));

  return row?.n ?? 0;
};

const entry: AuditEntry = {
  action: "demo.reset",
  actorUserId: null,
  entity: "database",
  entityId: null,
  before: null,
  after: { seededFor: "2026-10-30" },
};

test("an audit row rolls back with its transaction", async () => {
  const db = await getTestDb();
  const before = await resets();

  await expect(
    db.transaction(async (tx) => {
      await audit(tx, entry);
      throw new Error("the change failed");
    }),
  ).rejects.toThrow("the change failed");

  expect(await resets()).toBe(before);
});

test("demo reset keeps earlier audit rows and records itself", async () => {
  const db = await getTestDb();
  await resetDb(db);
  const afterFirst = await resets();
  await resetDb(db);

  expect(await resets()).toBe(afterFirst + 1);
});

// Drizzle wraps the Postgres error; the trigger's message is on `cause`.
const blockedBy = (op: string) => `audit_log is append-only (${op} blocked)`;

test("audit_log rejects update, delete and truncate", async () => {
  const db = await getTestDb();
  await audit(db, entry);

  await expect(db.update(auditLog).set({ entity: "x" }).execute()).rejects.toHaveProperty(
    "cause.message",
    blockedBy("UPDATE"),
  );
  await expect(db.delete(auditLog).execute()).rejects.toHaveProperty("cause.message", blockedBy("DELETE"));
  // db.execute() returns a lazy query builder; awaiting inside a function turns it into a real promise.
  await expect((async () => db.execute(sql`TRUNCATE audit_log`))()).rejects.toHaveProperty(
    "cause.message",
    blockedBy("TRUNCATE"),
  );
});
