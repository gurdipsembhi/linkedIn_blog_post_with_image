export type WikiReference = { title: string; url: string; text: string };

// Below this the extract is a stub — not enough material to ground a technical post.
const MIN_EXTRACT_CHARS = 400;
const MAX_EXTRACT_CHARS = 8000;

// Wikipedia's API etiquette asks for a descriptive User-Agent.
const UA = "linkedin-post-agent/0.1 (personal project)";

/**
 * Find the Wikipedia article for a topic and return its plain-text extract —
 * the grounding source for topic-explainer posts. Returns null when no usable
 * article exists — never throws.
 */
export async function fetchWikipediaReference(topic: string): Promise<WikiReference | null> {
  const title = await searchTitle(topic);
  if (!title) return null;
  return fetchExtract(title);
}

async function searchTitle(topic: string): Promise<string | null> {
  const json = await api({ action: "query", list: "search", srlimit: "1", srsearch: topic });
  return json?.query?.search?.[0]?.title ?? null;
}

async function fetchExtract(title: string): Promise<WikiReference | null> {
  const json = await api({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    titles: title,
  });
  const pages = json?.query?.pages;
  const page = pages ? (Object.values(pages)[0] as { title?: string; extract?: string }) : null;
  const text = page?.extract?.trim() ?? "";
  if (!page?.title || text.length < MIN_EXTRACT_CHARS) return null;
  return {
    title: page.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    text: text.slice(0, MAX_EXTRACT_CHARS),
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- MediaWiki API responses are deeply dynamic */
async function api(params: Record<string, string>): Promise<any | null> {
  try {
    const query = new URLSearchParams({ ...params, format: "json" });
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${query}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
