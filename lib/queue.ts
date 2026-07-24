import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

// Local-file review queue (stopgap until the database lands). Holds drafts the
// scheduler produced that are waiting for the user to approve or discard.
const FILE = path.join(process.cwd(), "data", "queue.json");

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
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeQueue(items: QueuedDraft[]): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2));
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
