import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { recordPost } from "@/lib/history";
import { createPost, uploadImage } from "@/lib/linkedin";
import { IMAGES_DIR } from "@/lib/render";
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
  const imageFile = typeof body.imageFile === "string" ? path.basename(body.imageFile) : "";
  const imageAlt = typeof body.imageAlt === "string" ? body.imageAlt : "";

  try {
    let image: { urn: string; altText?: string } | undefined;
    if (imageFile) {
      let data: Buffer;
      try {
        data = await readFile(path.join(IMAGES_DIR, imageFile));
      } catch {
        return NextResponse.json(
          { error: "Attached image file not found — regenerate the image and try again." },
          { status: 400 }
        );
      }
      const urn = await uploadImage(session.accessToken, session.personId, data);
      image = { urn, ...(imageAlt && { altText: `Explainer: ${imageAlt}` }) };
    }

    const postUrn = await createPost(session.accessToken, session.personId, text, image);
    try {
      await recordPost({
        postedAt: new Date().toISOString(),
        domain,
        postUrn,
        sourceTitle: source?.title ?? null,
        sourceLink: source?.link ?? null,
      });
    } catch (historyErr) {
      console.error("Post published but history write failed:", historyErr);
    }
    return NextResponse.json({
      postUrn,
      url: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}/` : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish post";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
