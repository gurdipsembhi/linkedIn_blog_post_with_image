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
  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!domain) {
    return NextResponse.json(
      { error: 'A domain is required (e.g. "AI", "fintech", "HR").' },
      { status: 400 }
    );
  }

  try {
    const result = await generatePost(domain, notes || undefined);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Draft generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
