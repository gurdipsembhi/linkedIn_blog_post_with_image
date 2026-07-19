import { NextResponse } from "next/server";
import { getAuthorizeUrl } from "@/lib/linkedin";

export async function GET() {
  if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_REDIRECT_URI) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID / LINKEDIN_REDIRECT_URI are not set in .env.local" },
      { status: 500 }
    );
  }
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(getAuthorizeUrl(state));
  response.cookies.set("li_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
