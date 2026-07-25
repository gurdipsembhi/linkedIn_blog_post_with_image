import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { IMAGES_DIR } from "@/lib/data-dir";
import { getSession } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { file } = await params;
  const name = path.basename(file);
  if (!/^[\w.-]+\.png$/.test(name)) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  try {
    const data = await readFile(path.join(IMAGES_DIR, name));
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
