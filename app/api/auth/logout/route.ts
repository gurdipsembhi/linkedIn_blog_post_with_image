import { NextRequest, NextResponse } from "next/server";
import { clearAccount } from "@/lib/account";
import { saveSchedule } from "@/lib/schedule";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET(request: NextRequest) {
  // Drop the persisted token and disable the scheduler so it can't run without an account.
  await clearAccount();
  await saveSchedule({ enabled: false });
  const response = NextResponse.redirect(new URL("/", request.nextUrl));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
