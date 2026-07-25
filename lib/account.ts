import { kvDel, kvGet, kvSet } from "./kv";

export type Account = {
  accessToken: string;
  expiresAt: number; // epoch ms
  personId: string;
  name: string;
};

// Server-side token store so the scheduler can post without a browser cookie.
// Durable via lib/kv (Upstash Redis on Vercel). Single-user by design. Treat as
// a secret — never expose the token to the client.
const KEY = "account";

export async function saveAccount(account: Account): Promise<void> {
  // Best-effort: this only feeds the server-side scheduler. The interactive user is
  // authenticated by the session cookie, so a failed write here must never block login.
  // Log and move on rather than throwing.
  try {
    await kvSet(KEY, account);
  } catch (err) {
    console.error("saveAccount failed (continuing; scheduler won't have a token):", err);
  }
}

/** Persisted account, or null if none. Does NOT check expiry — callers decide. */
export async function readAccount(): Promise<Account | null> {
  return kvGet<Account>(KEY);
}

/** Account usable for posting now, or null if missing or the token has expired. */
export async function getUsableAccount(): Promise<Account | null> {
  const account = await readAccount();
  if (!account) return null;
  if (Date.now() >= account.expiresAt) return null;
  return account;
}

export async function clearAccount(): Promise<void> {
  await kvDel(KEY);
}
