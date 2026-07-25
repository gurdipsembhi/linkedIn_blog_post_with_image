import { kvGet, kvSet } from "./kv";

export type HistoryEntry = {
  postedAt: string;
  domain: string;
  postUrn: string | null;
  sourceTitle: string | null;
  sourceLink: string | null;
};

// Durable post history (via lib/kv — Upstash Redis on Vercel). Feeds dedupe.
const KEY = "history";

export async function readHistory(): Promise<HistoryEntry[]> {
  return (await kvGet<HistoryEntry[]>(KEY)) ?? [];
}

export async function recordPost(entry: HistoryEntry): Promise<void> {
  const history = await readHistory();
  history.push(entry);
  await kvSet(KEY, history);
}

/** Links of articles that already produced a published post, for dedupe. */
export async function postedLinks(): Promise<Set<string>> {
  const history = await readHistory();
  return new Set(
    history.map((entry) => entry.sourceLink).filter((link): link is string => !!link)
  );
}
