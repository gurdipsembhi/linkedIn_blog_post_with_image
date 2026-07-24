import { NextResponse } from "next/server";
import { runScheduledJob } from "@/lib/run-scheduled";
import { getSession } from "@/lib/session";

/** Manual "Run now" from the dashboard — bypasses the 1/day cap so you can test the cycle. */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const outcome = await runScheduledJob(true);
  return NextResponse.json(outcome);
}
