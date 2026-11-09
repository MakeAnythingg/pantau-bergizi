import type { DbOrTx } from "@/db";
import { auditLog, type episode, type report } from "@/db/schema";

type AuditAction = (typeof auditLog.$inferInsert)["action"];

type EventSpec = { entity: string; entityId: number | null; before: object | null; after: object | null };

// Requires a spec for every action in the enum.
type EveryAction<T extends Record<AuditAction, EventSpec>> = T;

/**
 * What each action records. Adding an action = add it to `audit_action` in the schema (plus migration) and here;
 * forgetting this side is a type error.
 */
type EpisodeClose = { closedAt: Date | null; closedNote: string | null; closedByUserId: number | null };

type ReportStatus = Pick<typeof report.$inferSelect, "status" | "rejectReason">;

type Forwarding = Pick<typeof episode.$inferSelect, "forwarding" | "forwardingNote">;

type MenuContent = { name: string; composition: string };

type AuditEvents = EveryAction<{
  "demo.reset": { entity: "database"; entityId: null; before: null; after: { seededFor: string } };
  "episode.closed": { entity: "episode"; entityId: number; before: EpisodeClose; after: EpisodeClose };
  "episode.forwarding_changed": { entity: "episode"; entityId: number; before: Forwarding; after: Forwarding };
  "report.status_changed": { entity: "report"; entityId: number; before: ReportStatus; after: ReportStatus };
  "report.merged": {
    entity: "report";
    entityId: number;
    before: { duplicateOf: null };
    after: { duplicateOf: number };
  };
  "response.created": {
    entity: "response";
    entityId: number;
    before: null;
    after: { reportId: number | null; episodeId: number | null };
  };
  "menu.updated": { entity: "menu"; entityId: number; before: MenuContent | null; after: MenuContent };
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
