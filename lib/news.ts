import Parser from "rss-parser";

export type NewsItem = {
  title: string;
  link: string;
  publishedAt: string;
  snippet: string;
};

const parser = new Parser();

/** Fresh news for a domain via Google News search RSS — no API key required. */
export async function fetchNewsItems(domain: string, limit = 12): Promise<NewsItem[]> {
  const query = encodeURIComponent(`${domain} when:7d`);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; linkedin-post-agent)" },
  });
  if (!res.ok) {
    throw new Error(`News feed fetch failed (${res.status}) for domain "${domain}"`);
  }
  const feed = await parser.parseString(await res.text());
  return (feed.items ?? [])
    .filter((item) => item.title && item.link)
    .slice(0, limit)
    .map((item) => ({
      title: item.title!,
      link: item.link!,
      publishedAt: item.pubDate ?? "",
      snippet: item.contentSnippet?.slice(0, 300) ?? "",
    }));
}
