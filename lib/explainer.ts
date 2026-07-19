import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

export const ICONS = [
  "pencil",
  "code",
  "search",
  "doc",
  "chart",
  "chat",
  "bulb",
  "target",
] as const;
export type IconName = (typeof ICONS)[number];

export const LAYOUTS = ["process", "comparison", "keypoints"] as const;
export type LayoutName = (typeof LAYOUTS)[number];

type BaseSpec = {
  title: string;
  intro: string;
  useCases: { icon: IconName; label: string }[];
  note: string;
};

export type ProcessSpec = BaseSpec & {
  layout: "process";
  steps: string[];
  flowSteps: string[];
  decisionQuestion: string;
  finalLabel: string;
  exampleHeading: string;
  example: string;
};

export type ComparisonSpec = BaseSpec & {
  layout: "comparison";
  leftHeading: string;
  rightHeading: string;
  rows: { aspect: string; left: string; right: string }[];
  verdict: string;
};

export type KeyPointsSpec = BaseSpec & {
  layout: "keypoints";
  points: { heading: string; detail: string }[];
  stat: { value: string; caption: string } | null;
  whyItMatters: string;
};

export type ExplainerSpec = ProcessSpec | ComparisonSpec | KeyPointsSpec;

const model = () => google(process.env.AI_MODEL ?? "gemini-2.5-flash");

// Array size caps live in the descriptions + post-call slicing, not zod .max():
// Gemini treats hard maxItems as optional and fails validation when it overshoots.
const baseFields = {
  title: z.string().describe("Page title, 2-4 words"),
  intro: z
    .string()
    .describe("2-3 plain sentences (max 45 words) introducing the subject simply"),
  useCases: z
    .array(
      z.object({
        icon: z.enum(ICONS),
        label: z.string().describe("Use case, max 3 words"),
      })
    )
    .min(4)
    .describe("4-6 entries for where this is relevant, with a fitting icon each"),
  note: z.string().describe("One practical warning or tip, max 22 words"),
};

const layoutSchemas = {
  process: z.object({
    ...baseFields,
    steps: z
      .array(z.string().describe("One short step, max 7 words"))
      .min(4)
      .describe("4-7 numbered 'How it works' steps"),
    flowSteps: z
      .array(z.string().describe("Very short box label, max 3 words"))
      .min(3)
      .describe("3-4 flowchart boxes before the decision diamond, in order"),
    decisionQuestion: z
      .string()
      .describe("Decision diamond question, max 5 words, e.g. 'Score >= Target?'"),
    finalLabel: z.string().describe("Final success box label, max 3 words"),
    exampleHeading: z
      .string()
      .describe("Heading for the example section, e.g. 'Example Prompt:'"),
    example: z
      .string()
      .describe("A concrete example in 30-55 words, quoted if it is a prompt or phrase"),
  }),
  comparison: z.object({
    ...baseFields,
    leftHeading: z.string().describe("Left option name, max 3 words"),
    rightHeading: z.string().describe("Right option name, max 3 words"),
    rows: z
      .array(
        z.object({
          aspect: z.string().describe("Compared aspect, max 3 words"),
          left: z.string().describe("Left side of this aspect, max 8 words"),
          right: z.string().describe("Right side of this aspect, max 8 words"),
        })
      )
      .min(3)
      .describe("3-5 comparison rows"),
    verdict: z
      .string()
      .describe("One-line practical takeaway of the comparison, max 18 words"),
  }),
  keypoints: z.object({
    ...baseFields,
    points: z
      .array(
        z.object({
          heading: z.string().describe("Point heading, max 4 words"),
          detail: z.string().describe("Point detail, max 14 words"),
        })
      )
      .min(3)
      .describe("3-5 key points from the post, most important first"),
    stat: z
      .object({
        value: z.string().describe("The number itself, short, e.g. '380T' or '0.64%'"),
        caption: z.string().describe("What the number means, max 8 words"),
      })
      .nullable()
      .describe("The single most striking number in the post, or null if there is none"),
    whyItMatters: z.string().describe("Why a practitioner should care, max 25 words"),
  }),
};

const LAYOUT_PICKER_PROMPT = `You choose the best one-page visual layout for a hand-drawn study note that accompanies a LinkedIn post.
Layouts:
- "process": the post explains how a mechanism or workflow works step by step. The page shows numbered steps and a flowchart with a decision loop.
- "comparison": the post contrasts two approaches, tools, or generations of a technology. The page shows a two-column comparison table and a verdict.
- "keypoints": the post reports news, an announcement, or research findings — facts and implications rather than one mechanism. The page shows key facts, a standout number, and why it matters.
Pick the layout that genuinely matches the post's content — do not default to "process" when the post has no real step-by-step mechanism.`;

const SHARED_RULES = `Keep every string within its word limit — the page has fixed space. Plain language, no jargon, no markdown. Use only facts that appear in the post.`;

const SPEC_PROMPTS: Record<LayoutName, string> = {
  process: `You design one-page handwritten-style study notes that explain a single concept clearly.
The page has: a title, a short intro, numbered "How it works?" steps, a small flowchart
(sequential boxes, then a yes/no decision that loops back on "No"), a concrete example,
a row of use cases, and one practical note. The flowchart must describe the concept's
actual process, and the decision question must be the natural "are we done / did it work?"
check for that process. ${SHARED_RULES}`,
  comparison: `You design one-page handwritten-style study notes that compare two things clearly.
The page has: a title, a short intro, a two-column comparison table (each row one aspect),
a one-line verdict, a row of use cases, and one practical note. Compare the two things the
post actually contrasts. ${SHARED_RULES}`,
  keypoints: `You design one-page handwritten-style briefing notes that summarize news or findings clearly.
The page has: a title, a short intro, 3-5 key points (short heading + one-line detail),
optionally one standout statistic, a "Why it matters?" line, a row of icons for who/where
this is relevant, and one practical note. ${SHARED_RULES}`,
};

async function callSpec<SCHEMA extends z.ZodType>(
  schema: SCHEMA,
  layout: LayoutName,
  context: string
): Promise<z.infer<SCHEMA>> {
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema }),
    system: SPEC_PROMPTS[layout],
    prompt: `${context}\n\nDesign the page for this post.`,
  });
  return output as z.infer<SCHEMA>;
}

/** Picks the layout that fits the post, then distills the post into that layout's content. */
export async function generateExplainerSpec(
  domain: string,
  postText: string
): Promise<ExplainerSpec> {
  const context = `Domain: ${domain}

The LinkedIn post this image will accompany:
---
${postText}
---`;

  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: z.object({ layout: z.enum(LAYOUTS) }) }),
    system: LAYOUT_PICKER_PROMPT,
    prompt: context,
  });

  switch (output.layout) {
    case "comparison": {
      const spec = await callSpec(layoutSchemas.comparison, "comparison", context);
      return {
        layout: "comparison",
        ...spec,
        rows: spec.rows.slice(0, 5),
        useCases: spec.useCases.slice(0, 6),
      };
    }
    case "keypoints": {
      const spec = await callSpec(layoutSchemas.keypoints, "keypoints", context);
      return {
        layout: "keypoints",
        ...spec,
        points: spec.points.slice(0, 5),
        useCases: spec.useCases.slice(0, 6),
      };
    }
    default: {
      const spec = await callSpec(layoutSchemas.process, "process", context);
      return {
        layout: "process",
        ...spec,
        steps: spec.steps.slice(0, 7),
        flowSteps: spec.flowSteps.slice(0, 4),
        useCases: spec.useCases.slice(0, 6),
      };
    }
  }
}
