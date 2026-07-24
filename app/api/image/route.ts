import { NextResponse } from "next/server";
import { LAYOUTS, type LayoutName } from "@/lib/explainer";
import { generateExplainerImage } from "@/lib/image-pipeline";
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
  // Optional explicit template; anything else (incl. "auto"/missing) lets the model pick.
  const layout = LAYOUTS.includes(body.layout) ? (body.layout as LayoutName) : undefined;
  if (!postText) {
    return NextResponse.json(
      { error: "Generate or write the post text first — the image explains it." },
      { status: 400 }
    );
  }

  try {
    const { file, title, score } = await generateExplainerImage(domain || "general", postText, layout);
    return NextResponse.json({ file, url: `/api/image/${file}`, title, score });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
