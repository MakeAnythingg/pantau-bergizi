import type { DbOrTx } from "@/db";
import { auditLog } from "@/db/schema";

type AuditAction = (typeof auditLog.$inferInsert)["action"];

type EventSpec = { entity: string; entityId: number | null; before: object | null; after: object | null };

// Requires a spec for every action in the enum.
type EveryAction<T extends Record<AuditAction, EventSpec>> = T;

/**
 * What each action records. Adding an action = add it to `audit_action` in the schema (plus migration) and here;
 * forgetting this side is a type error.
 */
type AuditEvents = EveryAction<{
  "demo.reset": { entity: "database"; entityId: null; before: null; after: { seededFor: string } };
}>;

export type AuditEntry = {
  [A in AuditAction]: { action: A; actorUserId: number | null } & AuditEvents[A];
}[AuditAction];

/**
 * Records a staff change. Pass the transaction that makes the change, so the change and its audit row
 * commit or roll back together. `actorUserId` is null only for system actions (CLI reset, cron).
 */
export async function audit(tx: DbOrTx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values(entry);
}
