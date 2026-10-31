import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/index";
import { findSchool } from "@/db/reports";
import { addDays, todayWIB } from "@/lib/date";
import { getEnv } from "@/lib/env";
import { requestNow } from "@/lib/now";
import { CONSUMED_ON_MAX_BACKDATE_DAYS } from "@/lib/thresholds";
import { ReportForm } from "./report-form";

export default function LaporPage({ params }: PageProps<"/lapor/[code]">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pt-2">
      <Suspense fallback={<div className="h-[80vh]" />}>
        <LaporView params={params} />
      </Suspense>
    </main>
  );
}

async function LaporView({ params }: Pick<PageProps<"/lapor/[code]">, "params">) {
  const { code } = await params;

  if (code.length > 80) notFound();
  const today = todayWIB(await requestNow());
  const school = await findSchool(getDb(), code);

  if (!school) notFound();

  return (
    <ReportForm
      school={{ code: school.code, name: school.name, sppgName: school.sppgName }}
      siteKey={getEnv().TURNSTILE_SITE_KEY}
      today={today}
      minDate={addDays(today, -CONSUMED_ON_MAX_BACKDATE_DAYS)}
    />
  );
}
