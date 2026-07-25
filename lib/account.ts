import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { DATA_DIR } from "./data-dir";

export type Account = {
  accessToken: string;
  expiresAt: number; // epoch ms
  personId: string;
  name: string;
};

// Server-side token store so the scheduler can post without a browser cookie.
// Local-file stopgap (same as post-history) until the database lands — ephemeral
// on serverless deploys, and single-user by design. Treat as a secret: gitignored.
const FILE = path.join(DATA_DIR, "account.json");

export async function saveAccount(account: Account): Promise<void> {
  // Best-effort: this only feeds the server-side scheduler. The interactive user is
  // authenticated by the session cookie, so a failed write here must never block login
  // (e.g. read-only filesystems). Log and move on rather than throwing.
  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(account, null, 2));
  } catch (err) {
    console.error("saveAccount failed (continuing; scheduler won't have a token):", err);
  }
}

/** Persisted account, or null if none. Does NOT check expiry — callers decide. */
export async function readAccount(): Promise<Account | null> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return null;
  }
}

/** Account usable for posting now, or null if missing or the token has expired. */
export async function getUsableAccount(): Promise<Account | null> {
  const account = await readAccount();
  if (!account) return null;
  if (Date.now() >= account.expiresAt) return null;
  return account;
}

export async function clearAccount(): Promise<void> {
  try {
    await unlink(FILE);
  } catch {
    // already gone
  }
}
