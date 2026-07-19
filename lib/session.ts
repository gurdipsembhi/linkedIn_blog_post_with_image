import { cookies } from "next/headers";

export const SESSION_COOKIE = "li_session";

export type Session = {
  accessToken: string;
  expiresAt: number; // epoch ms
  personId: string;
  name: string;
};

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
    path: "/",
  };
}

/** Returns the LinkedIn session, or null if missing or expired (re-auth required). */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const session: Session = JSON.parse(raw);
    if (Date.now() >= session.expiresAt) return null;
    return session;
  } catch {
    return null;
  }
}
