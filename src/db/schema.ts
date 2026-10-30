import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { NOTE_MAX_CHARS } from "@/lib/thresholds";

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const createdNow = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const reporterRoleEnum = pgEnum("reporter_role", ["teacher", "student", "parent"]);
export const reportKindEnum = pgEnum("report_kind", ["experience", "health"]);
export const leftoverEnum = pgEnum("leftover", ["none", "little", "lots"]);
export const problemEnum = pgEnum("problem", ["stale", "foreign_object", "small_portion", "late", "none"]);
export const symptomEnum = pgEnum("symptom", ["nausea", "diarrhea", "dizzy", "other"]);
export const subjectEnum = pgEnum("subject", ["self", "group"]);
export const locationCheckEnum = pgEnum("location_check", ["inside", "outside", "unavailable"]);
export const reportStatusEnum = pgEnum("report_status", ["received", "reviewed", "responded", "closed", "rejected"]);
export const authorKindEnum = pgEnum("author_kind", ["sppg", "moderator", "reporter"]);
export const episodeRuleEnum = pgEnum("episode_rule", ["auto_multi_school", "teacher_group_reviewed"]);
export const forwardingEnum = pgEnum("forwarding", ["none", "simulated_puskesmas", "forwarded_by_officer"]);
export const userRoleEnum = pgEnum("user_role", ["moderator", "sppg_manager"]);

// One value per kind of staff change; features add theirs (with a migration) as they ship. See src/lib/audit.ts.
export const auditActionEnum = pgEnum("audit_action", ["demo.reset"]);

export const sppg = pgTable("sppg", {
  id: id(),
  name: text().notNull(),
  district: text().notNull(),
});

export const school = pgTable(
  "school",
  {
    id: id(),
    name: text().notNull(),
    code: text().notNull().unique(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    sppgId: integer()
      .notNull()
      .references(() => sppg.id),
  },
  (t) => [index().on(t.sppgId)],
);

export const menu = pgTable(
  "menu",
  {
    id: id(),
    sppgId: integer()
      .notNull()
      .references(() => sppg.id),
    servedOn: date({ mode: "string" }).notNull(),
    name: text().notNull(),
    composition: text().notNull(),
    photoUrl: text(),
    updatedAt: createdNow(),
  },
  (t) => [unique().on(t.sppgId, t.servedOn)],
);

export const report = pgTable(
  "report",
  {
    id: id(),
    schoolId: integer()
      .notNull()
      .references(() => school.id),
    simulated: boolean().notNull().default(false),
    reporterRole: reporterRoleEnum().notNull(),
    kind: reportKindEnum().notNull(),
    consumedOn: date({ mode: "string" }).notNull(),
    receivedAt: createdNow(),
    rating: integer(),
    leftover: leftoverEnum(),
    problems: problemEnum().array().notNull().default([]),
    symptoms: symptomEnum().array().notNull().default([]),
    subject: subjectEnum(),
    affectedCount: integer(),
    note: varchar({ length: NOTE_MAX_CHARS }),
    locationCheck: locationCheckEnum().notNull(),
    status: reportStatusEnum().notNull().default("received"),
    rejectReason: text(),
    duplicateOf: integer().references((): AnyPgColumn => report.id),
    tokenHash: text().notNull().unique(),
    deviceHash: text().notNull(),
    ipHash: text().notNull(),
  },
  (t) => [
    index().on(t.schoolId, t.receivedAt),
    index().on(t.status),
    check("report_rating_range", sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`),
  ],
);

export const episode = pgTable(
  "episode",
  {
    id: id(),
    sppgId: integer()
      .notNull()
      .references(() => sppg.id),
    firstDetectedAt: createdNow(),
    rule: episodeRuleEnum().notNull(),
    forwarding: forwardingEnum().notNull().default("none"),
    forwardingNote: text(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index()
      .on(t.sppgId)
      .where(sql`${t.closedAt} IS NULL`),
  ],
);

export const user = pgTable(
  "user",
  {
    id: id(),
    email: text().notNull().unique(),
    passwordHash: text().notNull(),
    role: userRoleEnum().notNull(),
    sppgId: integer().references(() => sppg.id),
    // Sessions carry this; bumping it logs the user out everywhere.
    sessionVersion: integer().notNull().default(0),
  },
  (t) => [check("user_manager_has_sppg", sql`${t.role} <> 'sppg_manager' OR ${t.sppgId} IS NOT NULL`)],
);

export const response = pgTable(
  "response",
  {
    id: id(),
    reportId: integer().references(() => report.id),
    episodeId: integer().references(() => episode.id),
    body: text().notNull(),
    createdAt: createdNow(),
    authorKind: authorKindEnum().notNull(),
    authorUserId: integer().references(() => user.id),
  },
  (t) => [check("response_one_target", sql`num_nonnulls(${t.reportId}, ${t.episodeId}) = 1`)],
);

// Fixed-window counters for src/lib/rate-limit.ts. Keys never hold a raw IP or email (see keyedHash).
export const rateLimit = pgTable(
  "rate_limit",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

// Append-only (UPDATE/DELETE blocked by a trigger, see drizzle/0003). Written only through audit().
// actor_user_id is deliberately NOT a foreign key: the demo reset truncates "user" with CASCADE, which would
// otherwise wipe this table too.
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    at: createdNow(),
    actorUserId: integer(),
    action: auditActionEnum().notNull(),
    entity: text().notNull(),
    entityId: integer(),
    before: jsonb(),
    after: jsonb(),
  },
  (t) => [index().on(t.at)],
);

export type NewReport = typeof report.$inferInsert;
