import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.nextUrl));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
