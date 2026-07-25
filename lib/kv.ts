import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { Redis } from "@upstash/redis";
import { DATA_DIR } from "./data-dir";

// Durable key-value store for the small, single-user JSON documents (account,
// schedule, queue, history). Uses Upstash Redis when its env vars are present
// (production on Vercel — provisioned via the Marketplace integration), and
// falls back to a local JSON file per key so `npm run dev` works without Redis.
//
// The Vercel Upstash integration exposes the connection as either the KV_* or
// UPSTASH_* pair depending on how it was added, so accept both.
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = url && token ? new Redis({ url, token }) : null;

/** True when a durable Redis backend is configured (vs the local-file fallback). */
export function kvConfigured(): boolean {
  return redis !== null;
}

/** Reads a value, or null if the key is unset. Upstash (de)serializes JSON itself. */
export async function kvGet<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  try {
    return JSON.parse(await readFile(fileFor(key), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  if (redis) {
    await redis.set(key, value);
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(fileFor(key), JSON.stringify(value, null, 2));
}

export async function kvDel(key: string): Promise<void> {
  if (redis) {
    await redis.del(key);
    return;
  }
  try {
    await unlink(fileFor(key));
  } catch {
    // already gone
  }
}

function fileFor(key: string): string {
  return path.join(DATA_DIR, `${key}.json`);
}
