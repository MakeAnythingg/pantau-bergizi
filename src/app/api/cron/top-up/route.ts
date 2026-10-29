import { db } from "@/db";
import { topUp } from "@/db/top-up";
import { safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";

// Called daily by Vercel Cron (see vercel.json), which sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(Buffer.from(auth), Buffer.from(`Bearer ${env.CRON_SECRET}`))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return Response.json(await topUp(db));
}
