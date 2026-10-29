import { endSession } from "@/lib/session";

// A plain form POST (not a server action) so logout is a full page load: Next 16 keeps visited
// pages alive in hidden <Activity> DOM, and a full load is the only way to drop the dashboard's.
export async function POST(request: Request) {
  await endSession();
  return Response.redirect(new URL("/masuk", request.url), 303);
}
