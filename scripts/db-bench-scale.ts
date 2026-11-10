import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createDb, one } from "@/db";
import { getBoard, getRapor } from "@/db/board";
import { findReportByCode } from "@/db/reports";
import { sppg } from "@/db/schema";
import { getManagerDashboard, getReviewQueue } from "@/db/staff";
import {
  localScaleUrl,
  SCALE_CODE,
  SCALE_DISTRICT,
  SCALE_KITCHEN,
  SCALE_KITCHENS,
  SCALE_NOW,
  SCALE_REPORTS,
  SCALE_SCHOOLS,
} from "./scale-fixture";

// Drizzle encodes these queries' parameters before logging, including dates and SQL arrays.
const parameters = z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]));

type Query = { text: string; params: z.infer<typeof parameters> };

type Plan = { "Execution Time": number; "Planning Time": number; Plan: object };

let queries: Query[] = [];

const db = createDb(localScaleUrl(), {
  logQuery(text, params) {
    queries.push({ text, params: parameters.parse(params) });
  },
});

const samples = 3;
const plansRequested = process.argv.includes("--plans");

async function measure(label: string, budget: number, run: () => Promise<boolean>) {
  queries = [];

  if (!(await run())) throw new Error(`Fixture did not exercise ${label}.`);

  const statements = queries;
  const timings: number[] = [];

  for (let sample = 0; sample < samples; sample++) {
    let total = 0;

    for (const { text, params } of statements) {
      const row = one(
        await db.$client.unsafe<{ "QUERY PLAN": Plan[] }[]>(`explain (analyze, buffers, format json) ${text}`, params),
      );

      const plan = one(row["QUERY PLAN"]);

      total += plan["Execution Time"];

      if (plansRequested && sample === 0) console.log(JSON.stringify({ label, text, ...plan }, null, 2));
    }

    timings.push(total);
  }

  const worst = Math.max(...timings);

  return {
    Kueri: label,
    SQL: statements.length,
    "Sampel (ms)": timings.map((time) => time.toFixed(3)).join(" / "),
    "Target (ms)": `< ${budget}`,
    Lulus: worst < budget,
  };
}

try {
  const volumes = one(
    await db.execute<{
      kitchens: number;
      schools: number;
      reports: number;
      episodes: number;
      first_day: string;
      last_day: string;
      version: string;
    }>(sql`
    select
      (select count(*)::int from sppg) as kitchens,
      (select count(*)::int from school) as schools,
      count(*)::int as reports,
      (select count(*)::int from episode) as episodes,
      min(consumed_on)::text as first_day,
      max(consumed_on)::text as last_day,
      current_setting('server_version') as version
    from report
  `),
  );

  if (
    volumes.kitchens !== SCALE_KITCHENS ||
    volumes.schools !== SCALE_SCHOOLS ||
    volumes.reports !== SCALE_REPORTS ||
    volumes.episodes === 0
  ) {
    throw new Error("Run db:seed:scale in an empty local database before benchmarking.");
  }

  console.log(volumes);

  const kitchen = one(await db.select({ id: sppg.id }).from(sppg).where(eq(sppg.name, SCALE_KITCHEN)));

  const results = [
    await measure("Beranda (satu wilayah)", 200, async () => {
      const board = await getBoard(db, SCALE_NOW, SCALE_DISTRICT);

      return board.some((row) => row.firstDetectedAt !== null);
    }),
    await measure("Rapor dapur + tabel per menu", 100, async () => {
      const rapor = await getRapor(db, kitchen.id, SCALE_NOW);

      return Boolean(rapor?.openEpisode?.replies.length && rapor.perMenu.days.some((day) => day.rated > 0));
    }),
    await measure("Antrean moderator", 100, async () => {
      const queue = await getReviewQueue(db, 1);

      return queue.hasMore && queue.items.some((item) => item.candidates.length > 0);
    }),
    await measure("Dasbor SPPG", 100, async () => {
      const dashboard = await getManagerDashboard(db, kitchen.id, SCALE_NOW, 1);

      return dashboard.items.length > 0 && dashboard.replies.length > 0;
    }),
    await measure("Pencarian kode lacak", 10, async () => {
      const tracked = await findReportByCode(db, SCALE_CODE);

      return Boolean(tracked?.responses.length && tracked.episodeReplies.length);
    }),
  ];

  console.table(results);

  if (results.some((result) => !result.Lulus)) process.exitCode = 1;
} finally {
  await db.$client.end();
}
