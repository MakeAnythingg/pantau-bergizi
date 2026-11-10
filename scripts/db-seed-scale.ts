import { sql } from "drizzle-orm";
import { createDb, one } from "@/db";
import { addDays, todayWIB } from "@/lib/date";
import { keyedHash } from "@/lib/keyed-hash";
import {
  localScaleUrl,
  SCALE_CODE,
  SCALE_DAYS,
  SCALE_KITCHENS,
  SCALE_NOW,
  SCALE_REPORTS,
  SCALE_SCHOOLS,
} from "./scale-fixture";

const url = localScaleUrl();
const trackingHash = keyedHash(SCALE_CODE);
const db = createDb(url);
const today = todayWIB(SCALE_NOW);
const schoolsPerKitchen = SCALE_SCHOOLS / SCALE_KITCHENS;
const reportsPerDay = Math.floor(SCALE_REPORTS / SCALE_DAYS);

try {
  await db.transaction(async (tx) => {
    // Serialize seed attempts and stop other writers while verifying and filling the empty fixture.
    await tx.execute(sql`lock table sppg, school, menu, episode, report, response in share row exclusive mode`);

    const { occupied } = one(
      await tx.execute<{ occupied: boolean }>(sql`select exists(select 1 from sppg) as occupied`),
    );

    if (occupied) throw new Error("Scale seed requires an empty, migrated database. No data was changed.");

    await tx.execute(sql`
      insert into sppg (name, district)
      select 'SPPG Simulasi ' || n, 'Kabupaten Simulasi ' || ((n - 1) / 60 + 1)
      from generate_series(1, ${SCALE_KITCHENS}::int) n
      order by n
    `);
    const { id: firstKitchen } = one(await tx.execute<{ id: number }>(sql`select min(id) as id from sppg`));

    await tx.execute(sql`
      insert into school (name, code, lat, lng, sppg_id)
      select 'Sekolah Simulasi ' || s.id || '-' || n, 'simulasi-' || s.id || '-' || n, -6.9, 107.6, s.id
      from sppg s cross join generate_series(1, ${schoolsPerKitchen}::int) n
      order by s.id, n
    `);
    const { id: firstSchool } = one(await tx.execute<{ id: number }>(sql`select min(id) as id from school`));

    await tx.execute(sql`
      insert into menu (sppg_id, served_on, name, composition)
      select id, ${today}::date - day, 'Menu Simulasi ' || day, 'Nasi, lauk, sayur, buah'
      from sppg cross join generate_series(0, 6) day
    `);
    await tx.execute(sql`
      insert into episode (sppg_id, first_detected_at, rule, closed_at, closed_note)
      select id, ((${today}::date - day) + time '12:45') at time zone 'Asia/Jakarta', 'auto_multi_school',
        case when day > 0 then ((${today}::date - day + 1) + time '12:00') at time zone 'Asia/Jakarta' end,
        case when day > 0 then 'Penutupan simulasi' end
      from sppg cross join (values (0), (10)) as offsets(day)
      where (id - ${firstKitchen}::int) % 50 = 0
    `);

    // Shift the schools sampled each day. Pair some health reports at the same school for the review queue.
    for (let day = 0; day < SCALE_DAYS; day++) {
      const date = addDays(today, -day);
      const count = reportsPerDay + Number(day < SCALE_REPORTS % SCALE_DAYS);
      await tx.execute(sql`
        insert into report (
          school_id, simulated, reporter_role, kind, consumed_on, received_at, rating, leftover,
          problems, symptoms, subject, affected_count, note, location_check, status,
          episode_id, token_hash, device_hash, ip_hash
        )
        select s.id, true,
          case when sample.teacher_group then 'teacher' else 'student' end::reporter_role,
          case when sample.health then 'health' else 'experience' end::report_kind,
          ${date}::date,
          ((${date}::date + time '08:00') at time zone 'Asia/Jakarta') + (n % 18000) * interval '1 second',
          case when not sample.health then 1 + n % 5 end,
          case when not sample.health then (array['none', 'little', 'lots'])[1 + n % 3]::leftover end,
          case when not sample.health and n % 31 = 0 then array['stale']::problem[] else '{}'::problem[] end,
          case when sample.health then array['nausea']::symptom[] else '{}'::symptom[] end,
          case when sample.teacher_group then 'group' when sample.health then 'self' end::subject,
          case when sample.teacher_group then 6 end,
          case when n % 17 = 0 then 'Catatan simulasi' end,
          'inside',
          case when n % 11 = 0 then 'closed' when n % 7 = 0 then 'reviewed'
            when n % 13 = 0 then 'responded' else 'received' end::report_status,
          e.id,
          case when n = 0 and ${day}::int = 0 then ${trackingHash}
            else encode(sha256(convert_to('token-' || ${day}::int || '-' || n, 'UTF8')), 'hex') end,
          encode(sha256(convert_to('device-' || (slot.school_slot % 90000), 'UTF8')), 'hex'),
          encode(sha256(convert_to('ip-' || (n % 1200), 'UTF8')), 'hex')
        from generate_series(0, ${count - 1}::int) n
        cross join lateral (select n - (n % 667 = 1)::int as school_slot) slot
        join school s on s.id = ${firstSchool}::int + (slot.school_slot * 59 + ${day}::int * 71) % ${SCALE_SCHOOLS}::int
        left join episode e on e.sppg_id = s.sppg_id
          and e.first_detected_at = ((${date}::date + time '12:45') at time zone 'Asia/Jakarta')
        cross join lateral (
          select e.id is not null or n % 23 = 0 or n % 667 = 1 as health,
            n % 667 = 0 as teacher_group
        ) sample
      `);
      console.log(`Seed hari ${day + 1}/${SCALE_DAYS}`);
    }

    await tx.execute(sql`
      insert into response (report_id, body, author_kind, created_at)
      select r.id, 'Tanggapan simulasi', 'reporter', r.received_at + interval '1 minute'
      from report r
      join generate_series(
        (select min(id) from report), (select max(id) from report), 5000
      ) sample(id) using (id)
    `);
    await tx.execute(sql`
      insert into response (report_id, body, author_kind, created_at)
      select id, 'Tanggapan untuk kode uji', 'sppg', received_at + interval '1 minute'
      from report where token_hash = ${trackingHash}
    `);
    await tx.execute(sql`
      insert into response (episode_id, body, author_kind, created_at)
      select id, 'Tanggapan episode simulasi', 'sppg', first_detected_at + interval '1 minute'
      from episode where closed_at is not null or sppg_id = ${firstKitchen}
    `);
  });
  await db.execute(sql`analyze sppg, school, menu, episode, report, response`);
  console.log(`Seed selesai: ${SCALE_KITCHENS} SPPG, ${SCALE_SCHOOLS} sekolah, ${SCALE_REPORTS} laporan.`);
} finally {
  await db.$client.end();
}
