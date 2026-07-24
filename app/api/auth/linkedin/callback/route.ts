import { NextRequest, NextResponse } from "next/server";
import { saveAccount } from "@/lib/account";
import { exchangeCodeForToken, getUserInfo } from "@/lib/linkedin";
import { SESSION_COOKIE, sessionCookieOptions, type Session } from "@/lib/session";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;

  const error = url.searchParams.get("error");
  if (error) {
    const description = url.searchParams.get("error_description") ?? error;
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(description)}`, url));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("li_oauth_state")?.value;
  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/?error=Invalid%20OAuth%20state", url));
  }

  try {
    const token = await exchangeCodeForToken(code);
    const user = await getUserInfo(token.access_token);
    const session: Session = {
      accessToken: token.access_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      personId: user.sub,
      name: user.name,
    };
    // Also persist server-side so the scheduler can post without the browser cookie.
    await saveAccount(session);
    const response = NextResponse.redirect(new URL("/", url));
    response.cookies.delete("li_oauth_state");
    response.cookies.set(
      SESSION_COOKIE,
      JSON.stringify(session),
      sessionCookieOptions(token.expires_in)
    );
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth callback failed";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, url));
  }
}
