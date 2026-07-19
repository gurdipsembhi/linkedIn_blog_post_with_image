import { google } from "@ai-sdk/google";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { generateText, Output } from "ai";
import { z } from "zod";
import { fetchArticleText } from "./article";
import { postedLinks } from "./history";
import { fetchNewsItems, type NewsItem } from "./news";
import { fetchWikipediaReference } from "./wikipedia";

// LangGraph orchestrates the agents; every model call stays on the AI SDK.

const MAX_DRAFTS = 3;

const model = () => google(process.env.AI_MODEL ?? "gemini-2.5-flash");

/** One structured-output model call — every agent goes through this. */
async function callAgent<SCHEMA extends z.ZodType>(args: {
  schema: SCHEMA;
  system: string;
  prompt: string;
}): Promise<z.infer<SCHEMA>> {
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: args.schema }),
    system: args.system,
    prompt: args.prompt,
  });
  return output as z.infer<SCHEMA>;
}

const CURATOR_PROMPT = `You curate news for a professional who posts practitioner insights on LinkedIn.
Pick the single most post-worthy item: fresh, substantive, discussion-provoking, and with enough
technical meat that the post can explain how something actually works. Avoid pure PR, funding-round
noise, and listicles. Also name the technical angle the post should explain in plain language.`;

const PLANNER_PROMPT = `You plan educational LinkedIn posts that explain a technical topic.
Given the topic and reference material, decide the teaching angle for a 130–250 word post: what a
practitioner audience most needs to understand, 2–3 sub-points to cover in order, and what to skip.
Favor one concrete mechanism or example over breadth. Ground the plan in the reference material.`;

const RESEARCHER_PROMPT = `You extract facts from source material for a ghostwriting pipeline.
Return the 15 most important atomic, verifiable claims stated in the source — what happened, names,
numbers, dates, and how the technology works — prioritizing the ones needed to explain the given
technical angle. Never add outside knowledge or interpretation. If the source is thin, return fewer
facts rather than padding.`;

const WRITER_STRUCTURE = {
  news: `- Cover what happened (the news update), then explain the technical angle in plain language
  (2–4 sentences a practitioner would find genuinely informative), then add an original take.`,
  topic: `- Teach the topic: what it is, then how it works in plain language following the outline,
  then when a practitioner would use it, then add an original take.`,
} as const;

const writerPrompt = (mode: PostMode) => `You write LinkedIn posts for a professional sharing insights in their field.
Rules:
- 130–250 words. Never exceed 250 words — cut content rather than run long.
- Plain text only (no markdown — LinkedIn does not render it).
- Open with a strong one-line hook, then short paragraphs of 2–3 sentences each,
  with a blank line between every paragraph. Never run paragraphs together.
${WRITER_STRUCTURE[mode]}
- Sound like a practitioner sharing a genuine observation, not an ad and not a news anchor.
- Every specific claim about the subject (numbers, names, dates, capabilities, quotes) must come
  from the provided source facts. Accurate general technical background is fine; never invent
  specifics.
- End with a question or takeaway, then 3–5 relevant hashtags on the final line.`;

const FACT_CHECKER_PROMPT = `You are a strict fact-checker for LinkedIn posts drafted from source material.
Compare the draft against the source facts and source text. Report a problem for:
- any specific claim about the subject (number, name, date, quote, capability) the source does not support
- anything that contradicts or distorts the source
Do not report: the author's opinions and takes, accurate general technical background, rhetorical
questions, hashtags, or reasonable paraphrases and summaries of what the source says. Only report
clear, material errors a reader would be misled by. Verdict "pass" only when there are no problems.`;

export type PostMode = "news" | "topic";

const State = Annotation.Root({
  mode: Annotation<PostMode>,
  domain: Annotation<string>,
  topic: Annotation<string>,
  notes: Annotation<string | undefined>,
  items: Annotation<NewsItem[]>,
  chosen: Annotation<NewsItem | null>,
  technicalAngle: Annotation<string>,
  outline: Annotation<string[]>,
  sourceKind: Annotation<"article" | "snippet">,
  sourceText: Annotation<string>,
  facts: Annotation<string[]>,
  draft: Annotation<string>,
  critique: Annotation<string | null>,
  drafts: Annotation<number>,
});

type PipelineState = typeof State.State;

/** Fetch fresh domain news and drop already-posted topics. Deterministic, no LLM. */
async function fetchNewsNode(state: PipelineState) {
  const [items, alreadyPosted] = await Promise.all([fetchNewsItems(state.domain), postedLinks()]);
  const fresh = items.filter((item) => !alreadyPosted.has(item.link));
  if (fresh.length === 0) {
    throw new Error(
      `No fresh news found for "${state.domain}" — the feed came back empty or every recent item was already posted about.`
    );
  }
  return { items: fresh };
}

/** Pick the most post-worthy item and decide which technical aspect the post should explain. */
async function curatorNode(state: PipelineState) {
  const list = state.items
    .map(
      (item, i) =>
        `${i + 1}. ${item.title}${item.publishedAt ? ` (${item.publishedAt})` : ""}${
          item.snippet ? `\n   ${item.snippet}` : ""
        }`
    )
    .join("\n");

  const { itemNumber, technicalAngle } = await callAgent({
    schema: z.object({
      itemNumber: z
        .number()
        .int()
        .min(1)
        .max(state.items.length)
        .describe("Number of the chosen news item"),
      technicalAngle: z
        .string()
        .describe("The technical aspect of the chosen story the post should explain in plain language"),
    }),
    system: CURATOR_PROMPT,
    prompt: `Today's news items for the "${state.domain}" domain:

${list}

Pick the single most post-worthy item for a practitioner audience.${
      state.notes ? `\n\nAngle or context the author wants worked in: ${state.notes}` : ""
    }`,
  });

  return { chosen: state.items[itemNumber - 1], technicalAngle };
}

/** Topic mode: find the Wikipedia article for the topic — the grounding source for the explainer. */
async function gatherReferencesNode(state: PipelineState) {
  const [reference, alreadyPosted] = await Promise.all([
    fetchWikipediaReference(state.topic),
    postedLinks(),
  ]);
  if (!reference) {
    throw new Error(
      `No reference material found for "${state.topic}" — try rephrasing the topic or picking a more established concept.`
    );
  }
  if (alreadyPosted.has(reference.url)) {
    throw new Error(
      `Already published a post about "${reference.title}" — pick a different topic or a fresh angle.`
    );
  }
  const chosen: NewsItem = { title: reference.title, link: reference.url, publishedAt: "", snippet: "" };
  return { chosen, sourceKind: "article" as const, sourceText: reference.text };
}

/** Topic mode: decide the teaching angle and outline so the post explains, not summarizes. */
async function plannerNode(state: PipelineState) {
  const { technicalAngle, outline } = await callAgent({
    schema: z.object({
      technicalAngle: z.string().describe("The single teaching angle the post should take"),
      outline: z
        .array(z.string())
        .min(1)
        .describe("The 2–3 sub-points to cover, in order"),
    }),
    system: PLANNER_PROMPT,
    prompt: `Topic: ${state.topic}

Reference material (Wikipedia: ${state.chosen!.title}):
${state.sourceText.slice(0, 4000)}${
      state.notes ? `\n\nAngle or context the author wants worked in: ${state.notes}` : ""
    }`,
  });
  return { technicalAngle, outline: outline.slice(0, 3) };
}

/** Distill the source into facts — the only ground truth downstream. News mode fetches the article first. */
async function researcherNode(state: PipelineState) {
  const chosen = state.chosen!;
  let { sourceKind, sourceText } = state;
  if (state.mode !== "topic") {
    const article = await fetchArticleText(chosen.link);
    sourceKind = article ? "article" : "snippet";
    sourceText = article ? article.text : `${chosen.title}\n${chosen.snippet}`.trim();
  }

  const { facts } = await callAgent({
    schema: z.object({
      facts: z
        .array(z.string())
        .min(1)
        .describe("Atomic, verifiable claims taken strictly from the source, most important first"),
    }),
    system: RESEARCHER_PROMPT,
    prompt: `Subject: ${chosen.title}
Technical angle the post will explain: ${state.technicalAngle}

Source ${sourceKind}:
${sourceText}`,
  });

  return { sourceKind, sourceText, facts: facts.slice(0, 15) };
}

/** Draft the post from the source facts; on revision, fix the fact-checker's problems. */
async function writerNode(state: PipelineState) {
  const chosen = state.chosen!;
  const factsList = state.facts.map((fact) => `- ${fact}`).join("\n");
  const limited =
    state.sourceKind === "snippet"
      ? "\n\nOnly the headline and snippet were available as source material — keep story specifics minimal and keep the technical section general."
      : "";
  const notes = state.notes ? `\n\nAngle or context the author wants worked in: ${state.notes}` : "";
  const revision = state.critique
    ? `\n\nYour previous draft:\n${state.draft}\n\nIt failed fact-checking. For each problem below, REMOVE the offending claim or replace it with wording directly supported by the source facts — do not simply rephrase it. Keep the rest intact:\n${state.critique}`
    : "";

  const subject =
    state.mode === "topic"
      ? `Topic to explain: ${state.topic}
Teaching angle: ${state.technicalAngle}
Outline:
${state.outline.map((point) => `- ${point}`).join("\n")}`
      : `Domain: "${state.domain}"
News item: ${chosen.title}${chosen.publishedAt ? ` (${chosen.publishedAt})` : ""}
Technical angle to explain: ${state.technicalAngle}`;

  const { post } = await callAgent({
    schema: z.object({
      post: z
        .string()
        .describe(
          "The LinkedIn post text. Plain text only. Paragraphs MUST be separated by blank lines (\\n\\n) — a single unbroken block is invalid."
        ),
    }),
    system: writerPrompt(state.mode),
    prompt: `${subject}

Source facts (the only permitted specifics about the subject):
${factsList}${limited}${notes}${revision}`,
  });

  return { draft: post, drafts: state.drafts + 1 };
}

/** Verify the draft against the source; pass clears the critique, fail sends it back to the writer. */
async function factCheckerNode(state: PipelineState) {
  const factsList = state.facts.map((fact) => `- ${fact}`).join("\n");
  const verdict = await callAgent({
    schema: z.object({
      verdict: z.enum(["pass", "fail"]),
      problems: z.array(z.string()).describe("Concrete problems found; empty when the verdict is pass"),
    }),
    system: FACT_CHECKER_PROMPT,
    prompt: `Source facts:
${factsList}

Source text:
${state.sourceText}

Draft:
${state.draft}`,
  });

  if (verdict.verdict === "pass") {
    return { critique: null };
  }
  const problems = verdict.problems.length
    ? verdict.problems
    : ["The fact-checker rejected the draft without naming specific problems."];
  if (state.drafts >= MAX_DRAFTS) {
    throw new Error(
      `Draft failed fact-checking after ${MAX_DRAFTS} attempts (${problems.join("; ")}) — try generating again.`
    );
  }
  return { critique: problems.map((problem) => `- ${problem}`).join("\n") };
}

const graph = new StateGraph(State)
  .addNode("fetchNews", fetchNewsNode)
  .addNode("curator", curatorNode)
  .addNode("gatherReferences", gatherReferencesNode)
  .addNode("planner", plannerNode)
  .addNode("researcher", researcherNode)
  .addNode("writer", writerNode)
  .addNode("factChecker", factCheckerNode)
  .addConditionalEdges(START, (state) => (state.mode === "topic" ? "gatherReferences" : "fetchNews"))
  .addEdge("fetchNews", "curator")
  .addEdge("curator", "researcher")
  .addEdge("gatherReferences", "planner")
  .addEdge("planner", "researcher")
  .addEdge("researcher", "writer")
  .addEdge("writer", "factChecker")
  .addConditionalEdges("factChecker", (state) => (state.critique ? "writer" : END))
  .compile();

export type GeneratedPost = {
  text: string;
  source: { title: string; link: string };
};

export type GenerateInput =
  | { mode: "news"; domain: string; notes?: string }
  | { mode: "topic"; topic: string; notes?: string };

/**
 * Full agent pipeline. News mode: fetch news → curate → research → draft → fact-check → validate.
 * Topic mode: gather references (Wikipedia) → plan → research → draft → fact-check → validate.
 */
export async function generatePost(input: GenerateInput): Promise<GeneratedPost> {
  const result = await graph.invoke({
    mode: input.mode,
    domain: input.mode === "news" ? input.domain : "",
    topic: input.mode === "topic" ? input.topic : "",
    notes: input.notes,
    drafts: 0,
  });
  const chosen = result.chosen!;
  const text = validateDraft(result.draft);
  return { text, source: { title: chosen.title, link: chosen.link } };
}

function validateDraft(raw: string): string {
  const text = raw
    .trim()
    // LinkedIn renders markdown literally, so strip any that slipped through
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1");
  if (!text) {
    throw new Error("Model returned an empty draft — try generating again.");
  }
  if (text.length > 3000) {
    throw new Error("Generated draft exceeded LinkedIn's 3,000-character limit — try generating again.");
  }
  return text;
}
