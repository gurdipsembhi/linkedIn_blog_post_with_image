import { NextResponse } from "next/server";
import { generateExplainerSpec } from "@/lib/explainer";
import { renderExplainerPng } from "@/lib/render";
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
      { error: "GOOGLE_GENERATIVE_AI_API_KEY is not set — add it to .env.local." },
      { status: 501 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  const postText = typeof body.postText === "string" ? body.postText.trim() : "";
  if (!postText) {
    return NextResponse.json(
      { error: "Generate or write the post text first — the image explains it." },
      { status: 400 }
    );
  }

  try {
    const spec = await generateExplainerSpec(domain || "general", postText);
    const file = await renderExplainerPng(spec);
    return NextResponse.json({ file, url: `/api/image/${file}`, title: spec.title });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
