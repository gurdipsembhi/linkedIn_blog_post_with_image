import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { postedLinks } from "./history";
import { fetchNewsItems } from "./news";

const SYSTEM_PROMPT = `You write LinkedIn posts for a professional sharing insights in their field.
Rules:
- 120–220 words, plain text only (no markdown — LinkedIn does not render it).
- Open with a strong one-line hook, then short paragraphs with line breaks.
- Sound like a practitioner sharing a genuine observation, not an ad and not a news anchor.
- Reference what actually happened in the chosen news item, then add an original take: what it means, what to do about it, or what most people miss.
- End with a question or takeaway, then 3–5 relevant hashtags on the final line.`;

export type GeneratedPost = {
  text: string;
  source: { title: string; link: string };
};

/** Full pipeline: fetch fresh domain news → drop already-posted topics → select + draft → validate. */
export async function generatePost(domain: string, notes?: string): Promise<GeneratedPost> {
  const [items, alreadyPosted] = await Promise.all([fetchNewsItems(domain), postedLinks()]);
  const fresh = items.filter((item) => !alreadyPosted.has(item.link));
  if (fresh.length === 0) {
    throw new Error(
      `No fresh news found for "${domain}" — the feed came back empty or every recent item was already posted about.`
    );
  }

  const list = fresh
    .map(
      (item, i) =>
        `${i + 1}. ${item.title}${item.publishedAt ? ` (${item.publishedAt})` : ""}${
          item.snippet ? `\n   ${item.snippet}` : ""
        }`
    )
    .join("\n");

  const { object } = await generateObject({
    model: google(process.env.AI_MODEL ?? "gemini-2.5-flash"),
    schema: z.object({
      itemNumber: z
        .number()
        .int()
        .min(1)
        .max(fresh.length)
        .describe("Number of the news item the post is based on"),
      post: z.string().describe("The LinkedIn post text, plain text only"),
    }),
    system: SYSTEM_PROMPT,
    prompt: `Today's news items for the "${domain}" domain:

${list}

Pick the single most post-worthy item for a practitioner audience — favor fresh, substantive, discussion-provoking stories; avoid pure PR, funding-round noise, and listicles. Then write the LinkedIn post grounded in that item.${
      notes ? `\n\nAngle or context the author wants worked in: ${notes}` : ""
    }`,
  });

  const source = fresh[object.itemNumber - 1];
  const text = validateDraft(object.post);
  return { text, source: { title: source.title, link: source.link } };
}

function validateDraft(raw: string): string {
  let text = raw
    .trim()
    // LinkedIn renders markdown literally, so strip any that slipped through
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1");
  if (!text) {
    throw new Error("Model returned an empty draft — try generating again.");
  }
  if (text.length > 3000) {
    throw new Error("Generated draft exceeded LinkedIn's 3,000-character limit — try generating again.");
  }
  return text;
}
