import { kvGet, kvSet } from "./kv";

// Durable review queue (via lib/kv — Upstash Redis on Vercel). Holds drafts the
// scheduler produced that are waiting for the user to approve or discard.
const KEY = "queue";

export type QueuedDraft = {
  id: string;
  createdAt: string; // ISO
  domain: string;
  text: string;
  source: { title: string; link: string } | null;
  imageFile: string | null; // PNG name in data/images, or null
  imageTitle: string | null;
};

export async function readQueue(): Promise<QueuedDraft[]> {
  return (await kvGet<QueuedDraft[]>(KEY)) ?? [];
}

async function writeQueue(items: QueuedDraft[]): Promise<void> {
  await kvSet(KEY, items);
}

export async function enqueueDraft(draft: Omit<QueuedDraft, "id" | "createdAt">): Promise<QueuedDraft> {
  const item: QueuedDraft = {
    ...draft,
    id: `draft-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const items = await readQueue();
  items.push(item);
  await writeQueue(items);
  return item;
}

export async function getDraft(id: string): Promise<QueuedDraft | null> {
  return (await readQueue()).find((item) => item.id === id) ?? null;
}

export async function removeDraft(id: string): Promise<void> {
  await writeQueue((await readQueue()).filter((item) => item.id !== id));
}
