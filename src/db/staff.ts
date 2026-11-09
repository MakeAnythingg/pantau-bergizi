import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { todayWIB } from "@/lib/date";
import { SURGE_MIN_REPORTS, SURGE_WINDOW_MINUTES, TEACHER_GROUP_MIN_AFFECTED } from "@/lib/thresholds";
import { getKitchenSignal } from "./board";
import { getEpisodeReplies, getOpenEpisodes } from "./episodes";
import type { Db } from "./index";
import { episode, menu, report, response, school, sppg } from "./schema";
import { reportFields } from "./signal-reports";

const PAGE_SIZE = 20;
const STAFF_STATUSES = ["reviewed", "responded"] as const;
const window = sql`make_interval(mins => ${SURGE_WINDOW_MINUTES})`;
const staffFields = { ...reportFields, kitchenName: sppg.name, rejectReason: report.rejectReason };

function reportList(db: Db) {
  return db
    .select(staffFields)
    .from(report)
    .innerJoin(school, eq(school.id, report.schoolId))
    .innerJoin(sppg, eq(sppg.id, school.sppgId));
}

type StaffRow = Awaited<ReturnType<typeof reportList>>[number];

async function withThreads<T extends StaffRow>(db: Db, rows: T[]) {
  if (rows.length === 0) return [];

  const replies = await db
    .select({
      id: response.id,
      reportId: response.reportId,
      authorKind: response.authorKind,
      body: response.body,
      createdAt: response.createdAt,
    })
    .from(response)
    .where(
      inArray(
        response.reportId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(response.createdAt), asc(response.id));

  return rows.map((row) => ({ ...row, thread: replies.filter((reply) => reply.reportId === row.id) }));
}

export type StaffReport = Awaited<ReturnType<typeof withThreads>>[number];

async function reviewDetails<T extends StaffRow>(db: Db, rows: T[]) {
  const child = alias(report, "child");
  const items = await withThreads(db, rows);
  const sources = items.filter((item) => item.duplicateOf === null && item.status !== "rejected");
  const candidate = alias(report, "candidate");

  const matches = sources.length
    ? await db
        .select({
          sourceId: report.id,
          id: candidate.id,
          at: candidate.receivedAt,
          status: candidate.status,
        })
        .from(report)
        .innerJoin(
          candidate,
          and(
            ne(report.id, candidate.id),
            eq(report.schoolId, candidate.schoolId),
            eq(report.kind, candidate.kind),
            eq(report.consumedOn, candidate.consumedOn),
            isNull(candidate.duplicateOf),
          ),
        )
        .where(
          and(
            inArray(
              report.id,
              sources.map((item) => item.id),
            ),
            notExists(db.select({ id: child.id }).from(child).where(eq(child.duplicateOf, report.id))),
          ),
        )
        .orderBy(asc(candidate.receivedAt), asc(candidate.id))
    : [];

  return items.map((item) => ({ ...item, candidates: matches.filter((match) => match.sourceId === item.id) }));
}

export async function getReviewQueue(db: Db, page: number) {
  const starts = alias(report, "surge_start");
  const member = alias(report, "surge_member");
  const repeat = alias(report, "repeat_report");

  const surge = db
    .select({ id: starts.id })
    .from(starts)
    .where(
      and(
        eq(starts.ipHash, report.ipHash),
        sql`${starts.receivedAt} between ${report.receivedAt} - ${window} and ${report.receivedAt}`,
        exists(
          db
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.ipHash, starts.ipHash),
                sql`${member.receivedAt} between ${starts.receivedAt} and ${starts.receivedAt} + ${window}`,
              ),
            )
            .offset(SURGE_MIN_REPORTS - 1),
        ),
      ),
    );

  const repeatHealth = db
    .select({ id: repeat.id })
    .from(repeat)
    .where(
      and(
        ne(repeat.id, report.id),
        eq(repeat.kind, "health"),
        eq(repeat.deviceHash, report.deviceHash),
        eq(repeat.schoolId, report.schoolId),
        eq(repeat.consumedOn, report.consumedOn),
      ),
    );

  const teacherGroup = and(
    eq(report.kind, "health"),
    eq(report.reporterRole, "teacher"),
    eq(report.subject, "group"),
    sql`${report.affectedCount} >= ${TEACHER_GROUP_MIN_AFFECTED}`,
  );

  const rows = await db
    .select({
      ...staffFields,
      surge: sql<boolean>`${exists(surge)}`,
      repeated: sql<boolean>`${report.kind} = 'health' and ${exists(repeatHealth)}`,
    })
    .from(report)
    .innerJoin(school, eq(school.id, report.schoolId))
    .innerJoin(sppg, eq(sppg.id, school.sppgId))
    .where(
      and(
        sql`${report.status} = 'received'`,
        isNull(report.duplicateOf),
        or(
          eq(report.kind, "health"),
          arrayOverlaps(report.problems, ["stale", "foreign_object"]),
          isNotNull(report.note),
        ),
      ),
    )
    .orderBy(
      sql`case when ${teacherGroup} then 0 when ${report.kind} = 'health' then 1 else 2 end`,
      asc(report.receivedAt),
      asc(report.id),
    )
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return { items: await reviewDetails(db, rows.slice(0, PAGE_SIZE)), hasMore: rows.length > PAGE_SIZE };
}

export async function getStaffReport(db: Db, id: number) {
  const rows = await reportList(db).where(eq(report.id, id));
  const [item] = await reviewDetails(db, rows);

  return item;
}

function lastActivity(db: Db, manager: boolean) {
  return db
    .select({
      author: response.authorKind,
      at: response.createdAt,
    })
    .from(response)
    .where(and(eq(response.reportId, report.id), manager ? ne(response.authorKind, "moderator") : undefined))
    .orderBy(desc(response.createdAt), desc(response.id))
    .limit(1)
    .as("last_activity");
}

export async function getFollowUp(db: Db, page: number) {
  const latest = lastActivity(db, false);

  const rows = await reportList(db)
    .leftJoinLateral(latest, sql`true`)
    .where(and(inArray(report.status, STAFF_STATUSES), isNull(report.duplicateOf)))
    .orderBy(desc(sql`coalesce(${latest.at}, ${report.receivedAt})`), desc(report.id))
    .limit(PAGE_SIZE + 1)
    .offset((page - 1) * PAGE_SIZE);

  return { items: await withThreads(db, rows.slice(0, PAGE_SIZE)), hasMore: rows.length > PAGE_SIZE };
}

export async function getManagerDashboard(db: Db, sppgId: number, now: Date, page: number) {
  const latest = lastActivity(db, true);

  const [[kitchen], [open], [todayMenu], [unreviewed], waiting] = await Promise.all([
    db.select().from(sppg).where(eq(sppg.id, sppgId)),
    getOpenEpisodes(db, now, sppgId),
    db
      .select()
      .from(menu)
      .where(and(eq(menu.sppgId, sppgId), eq(menu.servedOn, todayWIB(now)))),
    db
      .select({ count: count() })
      .from(report)
      .innerJoin(school, eq(school.sppgId, sppgId))
      .where(and(eq(school.id, report.schoolId), eq(report.status, "received"), isNull(report.duplicateOf))),
    reportList(db)
      .leftJoinLateral(latest, sql`true`)
      .where(
        and(
          eq(school.sppgId, sppgId),
          inArray(report.status, STAFF_STATUSES),
          isNull(report.duplicateOf),
          sql`${latest.author} is distinct from 'sppg'`,
        ),
      )
      .orderBy(asc(sql`coalesce(${latest.at}, ${report.receivedAt})`), asc(report.id))
      .limit(PAGE_SIZE + 1)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const [signal, items, replies] = await Promise.all([
    open?.signal ?? getKitchenSignal(db, sppgId, now),
    withThreads(db, waiting.slice(0, PAGE_SIZE)),
    open ? getEpisodeReplies(db, open.id) : [],
  ]);

  return {
    kitchen,
    signal,
    open,
    replies,
    todayMenu,
    unreviewed: unreviewed?.count ?? 0,
    items,
    hasMore: waiting.length > PAGE_SIZE,
  };
}

export async function getModeratorEpisodes(db: Db, now: Date) {
  const [open, closed, kitchens] = await Promise.all([
    getOpenEpisodes(db, now),
    db
      .select({ id: episode.id, kitchenName: sppg.name, closedAt: episode.closedAt, note: episode.closedNote })
      .from(episode)
      .innerJoin(sppg, eq(sppg.id, episode.sppgId))
      .where(isNotNull(episode.closedAt))
      .orderBy(desc(episode.closedAt), desc(episode.id))
      .limit(10),
    db.select().from(sppg),
  ]);

  const reports = open.length
    ? await db
        .select({
          id: report.id,
          episodeId: report.episodeId,
          schoolName: school.name,
          status: report.status,
        })
        .from(report)
        .innerJoin(school, eq(school.id, report.schoolId))
        .where(
          inArray(
            report.episodeId,
            open.map((item) => item.id),
          ),
        )
        .orderBy(asc(report.receivedAt), asc(report.id))
    : [];

  const names = new Map(kitchens.map((kitchen) => [kitchen.id, kitchen.name]));

  return {
    open: open
      .toSorted(
        (a, b) =>
          Number(b.overdueHours !== null) - Number(a.overdueHours !== null) ||
          a.firstDetectedAt.getTime() - b.firstDetectedAt.getTime(),
      )
      .map((item) => ({
        ...item,
        kitchenName: names.get(item.sppgId),
        reports: reports.filter((row) => row.episodeId === item.id),
      })),
    closed,
  };
}

type Surge = { startAt: string; endAt: string; count: number; schools: string[]; ids: number[] };

export function getSurges(db: Db, now: Date) {
  const since = new Date(now.getTime() - 24 * 3_600_000).toISOString();

  // Collapse overlapping windows with at least six reports into one burst.
  return db.execute<Surge>(sql`
    with recent as (
      select id, school_id, ip_hash, received_at,
        lead(received_at, ${SURGE_MIN_REPORTS - 1}) over (
          partition by ip_hash order by received_at, id
        ) as threshold_at
      from report where received_at between ${since}::timestamptz and ${now.toISOString()}::timestamptz
    ), windows as (
      select *, lag(threshold_at) over (partition by ip_hash order by received_at, id) as previous_end
      from recent where threshold_at <= received_at + ${window}
    ), grouped as (
      select *, sum(case when previous_end is null or received_at > previous_end then 1 else 0 end)
        over (partition by ip_hash order by received_at, id) as burst
      from windows
    ), bursts as (
      select ip_hash, min(received_at) as start_at, max(threshold_at) as end_at
      from grouped group by ip_hash, burst
    )
    select start_at::text as "startAt", end_at::text as "endAt", count(*)::int as count,
      array_agg(distinct school.name order by school.name) as schools,
      array_agg(recent.id order by recent.received_at, recent.id) as ids
    from bursts join recent using (ip_hash) join school on school.id = recent.school_id
    where recent.received_at between start_at and end_at
    group by bursts.ip_hash, start_at, end_at order by start_at desc
  `);
}
