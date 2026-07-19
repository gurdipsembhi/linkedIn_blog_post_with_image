import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type HistoryEntry = {
  postedAt: string;
  domain: string;
  postUrn: string | null;
  sourceTitle: string | null;
  sourceLink: string | null;
};

// Local-file history is a stopgap until the database lands (roadmap item 3).
// It is ephemeral on serverless deploys — fine for local development only.
const FILE = path.join(process.cwd(), "data", "post-history.json");

export async function readHistory(): Promise<HistoryEntry[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function recordPost(entry: HistoryEntry): Promise<void> {
  const history = await readHistory();
  history.push(entry);
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(history, null, 2));
}

/** Links of articles that already produced a published post, for dedupe. */
export async function postedLinks(): Promise<Set<string>> {
  const history = await readHistory();
  return new Set(
    history.map((entry) => entry.sourceLink).filter((link): link is string => !!link)
  );
}
