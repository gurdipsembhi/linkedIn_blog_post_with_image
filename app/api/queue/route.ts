import { NextResponse } from "next/server";
import { getUsableAccount } from "@/lib/account";
import { getDraft, readQueue, removeDraft } from "@/lib/queue";
import { publishPost } from "@/lib/publish";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return NextResponse.json({ drafts: await readQueue() });
}

/** Approve (publish) or discard a queued draft. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "discard" ? "discard" : "approve";
  if (!id) {
    return NextResponse.json({ error: "A draft id is required." }, { status: 400 });
  }

  const draft = await getDraft(id);
  if (!draft) {
    return NextResponse.json({ error: "Draft not found (already handled?)." }, { status: 404 });
  }

  if (action === "discard") {
    await removeDraft(id);
    return NextResponse.json({ status: "discarded" });
  }

  const account = await getUsableAccount();
  if (!account) {
    return NextResponse.json(
      { error: "LinkedIn token expired — reconnect before publishing." },
      { status: 401 }
    );
  }

  try {
    const result = await publishPost({
      accessToken: account.accessToken,
      personId: account.personId,
      text: draft.text,
      domain: draft.domain,
      source: draft.source,
      imageFile: draft.imageFile,
      imageAlt: draft.imageTitle,
    });
    await removeDraft(id);
    return NextResponse.json({ status: "published", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish draft";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
