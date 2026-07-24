import { NextResponse } from "next/server";
import { publishPost } from "@/lib/publish";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "LinkedIn session missing or expired — reconnect and try again." },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Post text is required." }, { status: 400 });
  }
  if (text.length > 3000) {
    return NextResponse.json(
      { error: "LinkedIn posts are limited to 3,000 characters." },
      { status: 400 }
    );
  }

  const domain = typeof body.domain === "string" ? body.domain.trim() : "";
  const source =
    body.source && typeof body.source.link === "string" && typeof body.source.title === "string"
      ? { title: body.source.title, link: body.source.link }
      : null;
  const imageFile = typeof body.imageFile === "string" ? body.imageFile : null;
  const imageAlt = typeof body.imageAlt === "string" ? body.imageAlt : null;

  try {
    const result = await publishPost({
      accessToken: session.accessToken,
      personId: session.personId,
      text,
      domain,
      source,
      imageFile,
      imageAlt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish post";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
