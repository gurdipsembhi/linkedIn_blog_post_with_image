import { NextRequest, NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/run-scheduled";

// Vercel Cron invokes this on schedule (see vercel.json). Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET`; we also accept it for manual curl testing.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // allow local runs when unset
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcome = await runScheduledJob();
  return NextResponse.json(outcome);
}
