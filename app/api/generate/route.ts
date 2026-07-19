import { NextResponse } from "next/server";
import { generatePost } from "@/lib/pipeline";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "LinkedIn session missing or expired — reconnect and try again." },
      { status: 401 }
    );
  }
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not set — add it to .env.local to enable draft generation." },
      { status: 501 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const mode = body.mode === "topic" ? ("topic" as const) : ("news" as const);
  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (mode === "news" && !domain) {
    return NextResponse.json(
      { error: 'A domain is required (e.g. "AI", "fintech", "HR").' },
      { status: 400 }
    );
  }
  if (mode === "topic" && !topic) {
    return NextResponse.json(
      { error: 'A topic is required (e.g. "retrieval-augmented generation").' },
      { status: 400 }
    );
  }

  try {
    const result = await generatePost(
      mode === "topic"
        ? { mode, topic, notes: notes || undefined }
        : { mode, domain, notes: notes || undefined }
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Draft generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
