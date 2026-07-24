import { NextResponse } from "next/server";
import { getSchedule, saveSchedule, type Schedule } from "@/lib/schedule";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return NextResponse.json(await getSchedule());
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: Partial<Schedule> = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.mode === "news" || body.mode === "topic") patch.mode = body.mode;
  if (typeof body.domain === "string") patch.domain = body.domain.trim();
  if (typeof body.topic === "string") patch.topic = body.topic.trim();
  if (typeof body.notes === "string") patch.notes = body.notes.trim();
  if (typeof body.attachImage === "boolean") patch.attachImage = body.attachImage;
  if (typeof body.autoPublish === "boolean") patch.autoPublish = body.autoPublish;

  const next = await getSchedule();
  const merged = { ...next, ...patch };
  if (merged.enabled) {
    if (merged.mode === "news" && !merged.domain) {
      return NextResponse.json(
        { error: "Set a domain before enabling the scheduler." },
        { status: 400 }
      );
    }
    if (merged.mode === "topic" && !merged.topic) {
      return NextResponse.json(
        { error: "Set a topic before enabling the scheduler." },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(await saveSchedule(patch));
}
