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

export const LAYOUTS = [
  "process",
  "comparison",
  "keypoints",
  "timeline",
  "dosdonts",
  "mythsfacts",
  "mindmap",
] as const;
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

export type TimelineSpec = BaseSpec & {
  layout: "timeline";
  events: { label: string; heading: string; detail: string }[];
  takeaway: string;
};

export type DosDontsSpec = BaseSpec & {
  layout: "dosdonts";
  dos: string[];
  donts: string[];
  goldenRule: string;
};

export type MythsFactsSpec = BaseSpec & {
  layout: "mythsfacts";
  pairs: { myth: string; fact: string }[];
  bottomLine: string;
};

export type MindMapSpec = BaseSpec & {
  layout: "mindmap";
  center: string;
  branches: { label: string; children: string[] }[];
  insight: string;
};

export type ExplainerSpec =
  | ProcessSpec
  | ComparisonSpec
  | KeyPointsSpec
  | TimelineSpec
  | DosDontsSpec
  | MythsFactsSpec
  | MindMapSpec;

const model = () => google(process.env.AI_MODEL ?? "gemini-2.5-flash");

// Array sizes are guided by the descriptions + prompts, not hard zod bounds. Gemini treats
// maxItems as optional (overshoots) and can't always hit a high minItems when the post is thin —
// both cause a hard NoObjectGeneratedError. So we keep only a .min(1) non-empty guarantee and
// enforce the upper cap by slicing after the call; a slightly sparse image beats a thrown error.
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
    .min(1)
    .describe("4-6 entries for where this is relevant, with a fitting icon each"),
  note: z.string().describe("One practical warning or tip, max 22 words"),
};

const layoutSchemas = {
  process: z.object({
    ...baseFields,
    steps: z
      .array(z.string().describe("One short step, max 7 words"))
      .min(1)
      .describe("4-7 numbered 'How it works' steps"),
    flowSteps: z
      .array(z.string().describe("Very short box label, max 3 words"))
      .min(1)
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
      .min(1)
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
      .min(1)
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
  timeline: z.object({
    ...baseFields,
    events: z
      .array(
        z.object({
          label: z.string().describe("When — a year, date, or phase, max 3 words, e.g. '2024' or 'Phase 2'"),
          heading: z.string().describe("What happened, max 4 words"),
          detail: z.string().describe("One-line detail, max 12 words"),
        })
      )
      .min(1)
      .describe("3-5 events in chronological order"),
    takeaway: z.string().describe("What the trajectory means going forward, max 20 words"),
  }),
  dosdonts: z.object({
    ...baseFields,
    dos: z
      .array(z.string().describe("One thing to do, max 8 words"))
      .min(1)
      .describe("3-5 do's"),
    donts: z
      .array(z.string().describe("One thing to avoid, max 8 words"))
      .min(1)
      .describe("3-5 don'ts"),
    goldenRule: z.string().describe("The single most important rule, max 18 words"),
  }),
  mythsfacts: z.object({
    ...baseFields,
    pairs: z
      .array(
        z.object({
          myth: z.string().describe("The misconception, max 10 words"),
          fact: z.string().describe("What is actually true, max 12 words"),
        })
      )
      .min(1)
      .describe("3-4 myth/fact pairs, most common misconception first"),
    bottomLine: z.string().describe("The one-line reality check, max 20 words"),
  }),
  mindmap: z.object({
    ...baseFields,
    center: z.string().describe("The central concept, max 3 words"),
    branches: z
      .array(
        z.object({
          label: z.string().describe("Branch name, max 3 words"),
          children: z
            .array(z.string().describe("Sub-item, max 3 words"))
            .describe("0-3 sub-items under this branch"),
        })
      )
      .min(1)
      .describe("4-6 branches covering the main aspects of the concept"),
    insight: z.string().describe("One insight tying the map together, max 20 words"),
  }),
};

const LAYOUT_PICKER_PROMPT = `You choose the best one-page visual layout for a hand-drawn study note that accompanies a LinkedIn post.
Layouts:
- "process": the post explains how a mechanism or workflow works step by step. The page shows numbered steps and a flowchart with a decision loop.
- "comparison": the post contrasts exactly two approaches, tools, or generations of a technology. The page shows a two-column comparison table and a verdict.
- "keypoints": the post reports news, an announcement, or research findings — facts and implications rather than one mechanism. The page shows key facts, a standout number, and why it matters.
- "timeline": the post traces how something evolved over time or a sequence of dated events. The page shows dated milestones down a vertical line.
- "dosdonts": the post gives best practices, advice, or lessons learned. The page shows a Do column and a Don't column plus a golden rule.
- "mythsfacts": the post debunks misconceptions. The page shows myth/fact pairs and a bottom line.
- "mindmap": the post surveys a concept's landscape — several parallel aspects or categories with no single mechanism, comparison, or sequence. The page shows a central bubble with labeled branches.
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
  timeline: `You design one-page handwritten-style study notes that show how something evolved.
The page has: a title, a short intro, a vertical timeline of 3-5 dated events (when + what
happened + one-line detail) in chronological order, a takeaway about where this is heading,
a row of use cases, and one practical note. ${SHARED_RULES}`,
  dosdonts: `You design one-page handwritten-style study notes that turn advice into a checklist.
The page has: a title, a short intro, a "Do" column and a "Don't" column (3-5 items each,
parallel where possible), one golden rule, a row of use cases, and one practical note.
${SHARED_RULES}`,
  mythsfacts: `You design one-page handwritten-style study notes that debunk misconceptions.
The page has: a title, a short intro, 3-4 myth/fact pairs (the misconception, then what is
actually true), a one-line bottom line, a row of use cases, and one practical note.
${SHARED_RULES}`,
  mindmap: `You design one-page handwritten-style mind maps that give an overview of a concept.
The page has: a title, a short intro, a central bubble with 4-6 labeled branches (each with
0-3 very short sub-items), one insight tying the map together, a row of use cases, and one
practical note. Branch labels and sub-items must be genuinely distinct aspects, not synonyms.
${SHARED_RULES}`,
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

/** Distills the post into the content for one specific layout (array caps enforced by slicing). */
async function buildSpec(layout: LayoutName, context: string): Promise<ExplainerSpec> {
  switch (layout) {
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
    case "timeline": {
      const spec = await callSpec(layoutSchemas.timeline, "timeline", context);
      return {
        layout: "timeline",
        ...spec,
        events: spec.events.slice(0, 5),
        useCases: spec.useCases.slice(0, 6),
      };
    }
    case "dosdonts": {
      const spec = await callSpec(layoutSchemas.dosdonts, "dosdonts", context);
      return {
        layout: "dosdonts",
        ...spec,
        dos: spec.dos.slice(0, 5),
        donts: spec.donts.slice(0, 5),
        useCases: spec.useCases.slice(0, 6),
      };
    }
    case "mythsfacts": {
      const spec = await callSpec(layoutSchemas.mythsfacts, "mythsfacts", context);
      return {
        layout: "mythsfacts",
        ...spec,
        pairs: spec.pairs.slice(0, 4),
        useCases: spec.useCases.slice(0, 6),
      };
    }
    case "mindmap": {
      const spec = await callSpec(layoutSchemas.mindmap, "mindmap", context);
      return {
        layout: "mindmap",
        ...spec,
        branches: spec.branches
          .slice(0, 6)
          .map((branch) => ({ ...branch, children: branch.children.slice(0, 3) })),
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

/** Asks the model which layout best fits the post. */
async function pickLayout(context: string): Promise<LayoutName> {
  const { output } = await generateText({
    model: model(),
    output: Output.object({ schema: z.object({ layout: z.enum(LAYOUTS) }) }),
    system: LAYOUT_PICKER_PROMPT,
    prompt: context,
  });
  return output.layout;
}

/**
 * Distills the post into a layout's content. When `layout` is given, that template is used
 * as-is; otherwise the model picks the layout that best fits the post.
 */
export async function generateExplainerSpec(
  domain: string,
  postText: string,
  layout?: LayoutName
): Promise<ExplainerSpec> {
  const context = `Domain: ${domain}

The LinkedIn post this image will accompany:
---
${postText}
---`;

  return buildSpec(layout ?? (await pickLayout(context)), context);
}
