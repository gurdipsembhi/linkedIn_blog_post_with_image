import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { DATA_DIR } from "./data-dir";

// Local-file schedule config (stopgap until the database lands). Single-user by design.
const FILE = path.join(DATA_DIR, "schedule.json");

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
  try {
    return { ...DEFAULTS, ...JSON.parse(await readFile(FILE, "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSchedule(patch: Partial<Schedule>): Promise<Schedule> {
  const next = { ...(await getSchedule()), ...patch };
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(next, null, 2));
  return next;
}

/** UTC date key for the ~1/day frequency cap. */
export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
