import { kvGet, kvSet } from "./kv";

// Durable schedule config (via lib/kv — Upstash Redis on Vercel). Single-user by design.
const KEY = "schedule";

export type Schedule = {
  enabled: boolean;
  mode: "news" | "topic";
  domain: string;
  topic: string;
  notes: string;
  attachImage: boolean;
  autoPublish: boolean; // false = draft lands in the review queue (the safe default)
  // Runtime status, updated by the cron run:
  lastRunDate: string | null; // YYYY-MM-DD (UTC) — enforces the ~1/day cap
  lastRunAt: string | null; // ISO timestamp
  lastResult: string | null; // human-readable outcome of the last run
  lastError: string | null; // set when the last run failed (e.g. token expired)
};

const DEFAULTS: Schedule = {
  enabled: false,
  mode: "news",
  domain: "",
  topic: "",
  notes: "",
  attachImage: true,
  autoPublish: false,
  lastRunDate: null,
  lastRunAt: null,
  lastResult: null,
  lastError: null,
};

export async function getSchedule(): Promise<Schedule> {
  const stored = await kvGet<Partial<Schedule>>(KEY);
  return { ...DEFAULTS, ...(stored ?? {}) };
}

export async function saveSchedule(patch: Partial<Schedule>): Promise<Schedule> {
  const next = { ...(await getSchedule()), ...patch };
  await kvSet(KEY, next);
  return next;
}

/** UTC date key for the ~1/day frequency cap. */
export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
