import { readFile, unlink } from "fs/promises";
import path from "path";
import { google } from "@ai-sdk/google";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  buildContext,
  buildSpec,
  pickLayout,
  type ExplainerSpec,
  type LayoutName,
} from "./explainer";
import { IMAGES_DIR } from "./data-dir";
import { renderExplainerPng } from "./render";

// Render → vision-review → (revise | accept) loop, mirroring the post pipeline's fact-check loop.

const MAX_ATTEMPTS = 3;
// Vision scoring is noisy; the reliable defect signal is the deterministic overflow check, so
// the score bar is a backstop, not the primary gate. A clean, non-overflowing page clears 6.
const PASS_SCORE = 6;
// A few pixels of clipped background line are harmless; real text overflow is much larger.
const OVERFLOW_TOLERANCE = 4;

const model = () => google(process.env.AI_MODEL ?? "gemini-2.5-flash");

const REVIEW_PROMPT = `You are a design QA reviewer for hand-drawn "study note" images that accompany LinkedIn posts.
Judge the rendered image primarily on legibility and layout, not writing style. Score 1-10 by this rubric:
- 8-10: clean and readable, nothing cut off, well balanced.
- 6-7: readable but slightly crammed or sparse, or minor spacing issues only.
- 1-5: real defects — text clipped at an edge, elements overlapping, text spilling outside its box/table/bubble, or empty/broken sections.
An illustrative example may use a plausible scenario not literally stated in the post — that is fine; only penalize invented claims about the subject itself. Give a "pass" verdict when the score is at least ${PASS_SCORE} and no text is cut off or overlapping. List concrete, actionable issues (what to shorten or remove); leave issues empty when it passes.`;

const reviewSchema = z.object({
  score: z.number().int().min(1).max(10).describe("Overall quality, 1-10"),
  verdict: z.enum(["pass", "fail"]),
  issues: z.array(z.string()).describe("Concrete problems to fix; empty when it passes"),
});

type Best = { file: string; title: string; score: number };

const State = Annotation.Root({
  context: Annotation<string>,
  postText: Annotation<string>,
  layout: Annotation<LayoutName | undefined>,
  spec: Annotation<ExplainerSpec>,
  file: Annotation<string>,
  overflowPx: Annotation<number>,
  critique: Annotation<string | null>,
  attempts: Annotation<number>,
  best: Annotation<Best | null>,
});

type PipelineState = typeof State.State;

/** Choose the layout once (only when the caller didn't pin one). */
async function pickNode(state: PipelineState) {
  return { layout: await pickLayout(state.context) };
}

/** Compose the layout's content; on a revision pass, fix the reviewer's critique. */
async function composeNode(state: PipelineState) {
  const spec = await buildSpec(state.layout!, state.context, state.critique);
  return { spec };
}

/** Render the spec to a PNG and measure how far it overflowed the fixed page. */
async function renderNode(state: PipelineState) {
  const { file, overflowPx } = await renderExplainerPng(state.spec);
  return { file, overflowPx };
}

/** Vision-review the rendered image, score it, and keep the best attempt so far. */
async function reviewNode(state: PipelineState) {
  const png = await readFile(path.join(IMAGES_DIR, state.file));
  const { output: review } = await generateText({
    model: model(),
    output: Output.object({ schema: reviewSchema }),
    system: REVIEW_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `The post this image accompanies:\n---\n${state.postText}\n---\n\nAutomated layout check measured ${state.overflowPx}px of content overflowing past the page bottom (0 means it fits). Review the attached image.`,
          },
          { type: "file", data: png, mediaType: "image/png" },
        ],
      },
    ],
  });

  const overflowed = state.overflowPx > OVERFLOW_TOLERANCE;
  // Overflow is a hard fail regardless of the model's optimism; the page literally clipped text.
  const score = overflowed ? Math.min(review.score, PASS_SCORE - 1) : review.score;
  const passed = review.verdict === "pass" && review.score >= PASS_SCORE && !overflowed;

  const attempts = state.attempts + 1;
  const candidate: Best = { file: state.file, title: state.spec.title, score };

  // Keep only the highest-scoring render on disk; discard the rest as we go.
  let best = state.best;
  if (!best || candidate.score > best.score) {
    if (best) await unlink(path.join(IMAGES_DIR, best.file)).catch(() => {});
    best = candidate;
  } else {
    await unlink(path.join(IMAGES_DIR, candidate.file)).catch(() => {});
  }

  if (passed) return { critique: null, attempts, best };

  const problems = review.issues.length
    ? review.issues
    : ["The image was rejected in review without specific issues."];
  if (overflowed) {
    problems.push(
      `Content overflows the page by ${state.overflowPx}px — shorten text and reduce the number of items.`
    );
  }
  return { critique: problems.map((p) => `- ${p}`).join("\n"), attempts, best };
}

const graph = new StateGraph(State)
  .addNode("pick", pickNode)
  .addNode("compose", composeNode)
  .addNode("render", renderNode)
  .addNode("review", reviewNode)
  .addConditionalEdges(START, (state) => (state.layout ? "compose" : "pick"))
  .addEdge("pick", "compose")
  .addEdge("compose", "render")
  .addEdge("render", "review")
  .addConditionalEdges("review", (state) =>
    state.critique === null || state.attempts >= MAX_ATTEMPTS ? END : "compose"
  )
  .compile();

export type ExplainerImage = { file: string; title: string; score: number };

/**
 * Generate, review, and (if needed) revise the explainer image. Returns the best-scoring
 * render — the image is optional decoration, so a low score is surfaced, not thrown.
 */
export async function generateExplainerImage(
  domain: string,
  postText: string,
  layout?: LayoutName
): Promise<ExplainerImage> {
  const result = await graph.invoke({
    context: buildContext(domain, postText),
    postText,
    layout,
    critique: null,
    attempts: 0,
    best: null,
  });
  const best = result.best!;
  return { file: best.file, title: best.title, score: best.score };
}
