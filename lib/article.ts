export type Article = { url: string; text: string };

// Below this the "article" is usually a paywall stub, cookie wall, or bot block —
// callers should fall back to the RSS snippet instead of feeding junk to the LLM.
const MIN_ARTICLE_CHARS = 400;
const MAX_ARTICLE_CHARS = 8000;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Fetch the readable text of the article behind a news link. Google News RSS
 * links are redirect wrappers, so this resolves them first. Returns null when
 * the article can't be reached or yields no usable text — never throws.
 */
export async function fetchArticleText(link: string): Promise<Article | null> {
  const resolved = isGoogleNewsLink(link)
    ? decodeGoogleNewsLink(link) ?? (await resolveViaBatchExecute(link))
    : null;
  let page = await fetchHtml(resolved ?? link);
  if (!page) return null;

  // Landed on a Google News interstitial: dig the publisher URL out of its HTML.
  if (isGoogleHost(page.url)) {
    const target = urlFromInterstitial(page.html);
    if (!target) return null;
    page = await fetchHtml(target);
    if (!page || isGoogleHost(page.url)) return null;
  }

  const text = htmlToText(page.html);
  if (text.length < MIN_ARTICLE_CHARS) return null;
  return { url: page.url, text: text.slice(0, MAX_ARTICLE_CHARS) };
}

function isGoogleNewsLink(link: string): boolean {
  try {
    return new URL(link).hostname === "news.google.com";
  } catch {
    return false;
  }
}

function articleId(link: string): string | null {
  try {
    return new URL(link).pathname.split("/").filter(Boolean).pop() ?? null;
  } catch {
    return null;
  }
}

/**
 * Newer Google News IDs (`…AU_yq…` payloads) don't embed the publisher URL; the
 * only known resolution is Google's internal batchexecute endpoint, called with
 * a signature + timestamp scraped from the article page (same technique as the
 * googlenewsdecoder project). Undocumented, so treat any failure as "unresolvable".
 */
async function resolveViaBatchExecute(link: string): Promise<string | null> {
  const id = articleId(link);
  if (!id) return null;
  const page = await fetchHtml(`https://news.google.com/articles/${id}`);
  if (!page) return null;
  const sg = page.html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const ts = page.html.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!sg || !ts) return null;

  try {
    const envelope = [
      "Fbv4je",
      `["garturlreq",[["X","X",["en-US","US"],null,null,1,1,"US:en",null,180,null,null,null,null,null,0,null,null,[1608992183,723341000]],"en-US","US",1,[2,3,4,8],1,0,"655000234",0,0,null,0],"${id}",${ts},"${sg}"]`,
    ];
    const res = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": BROWSER_UA,
      },
      body: "f.req=" + encodeURIComponent(JSON.stringify([[envelope]])),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    // Response is `)]}'` armor, a blank line, then the JSON payload.
    const payload = JSON.parse((await res.text()).split("\n\n")[1]);
    const url = JSON.parse(payload[0][2])[1];
    return typeof url === "string" && /^https?:\/\//.test(url) && !isGoogleHost(url) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Google News article IDs are base64url-encoded protobufs that (in the older
 * `CBMi…` format) embed the publisher's URL verbatim. Newer IDs don't, in which
 * case this returns null and the caller falls back to following redirects.
 */
function decodeGoogleNewsLink(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.hostname !== "news.google.com") return null;
    const id = url.pathname.split("/").filter(Boolean).pop();
    if (!id) return null;
    const raw = Buffer.from(id, "base64url").toString("latin1");
    const candidates = raw.match(/https?:\/\/[\w\-.~:/?#\[\]@!$&'()*+,;=%]+/g) ?? [];
    return candidates.find((c) => !isGoogleHost(c)) ?? null;
  } catch {
    return null;
  }
}

function isGoogleHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.includes("google.") || host.includes("gstatic.");
  } catch {
    return true;
  }
}

async function fetchHtml(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("html")) return null;
    return { url: res.url, html: await res.text() };
  } catch {
    return null;
  }
}

function urlFromInterstitial(html: string): string | null {
  const dataAttr = html.match(/data-n-au="(https?:\/\/[^"]+)"/);
  if (dataAttr) return decodeEntities(dataAttr[1]);
  for (const match of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const href = decodeEntities(match[1]);
    if (!isGoogleHost(href)) return href;
  }
  return null;
}

function htmlToText(html: string): string {
  let scope = html.replace(/<(script|style|noscript|svg|iframe|head)[\s\S]*?<\/\1>/gi, " ");
  const articleBlocks = scope.match(/<article[\s\S]*?<\/article>/gi);
  if (articleBlocks && articleBlocks.join("").length > 1000) {
    scope = articleBlocks.join("\n");
  }
  const text = scope
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}
