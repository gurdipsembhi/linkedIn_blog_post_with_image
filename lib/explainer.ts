import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
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

export type ExplainerSpec = {
  title: string;
  intro: string;
  steps: string[];
  flowSteps: string[];
  decisionQuestion: string;
  finalLabel: string;
  exampleHeading: string;
  example: string;
  useCases: { icon: IconName; label: string }[];
  note: string;
};

const schema = z.object({
  title: z.string().describe("Concept name, 2-4 words, e.g. 'Loop Prompt'"),
  intro: z
    .string()
    .describe("2-3 plain sentences (max 45 words) explaining the concept simply"),
  steps: z
    .array(z.string().describe("One short step, max 7 words"))
    .min(4)
    .max(7)
    .describe("Numbered 'How it works' steps"),
  flowSteps: z
    .array(z.string().describe("Very short box label, max 3 words"))
    .min(3)
    .max(4)
    .describe("Flowchart boxes before the decision diamond, in order"),
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
  useCases: z
    .array(
      z.object({
        icon: z.enum(ICONS),
        label: z.string().describe("Use case, max 3 words"),
      })
    )
    .min(4)
    .max(6)
    .describe("Where this concept helps, with a fitting icon each"),
  note: z.string().describe("One practical warning or tip, max 22 words"),
});

const SYSTEM_PROMPT = `You design one-page handwritten-style study notes that explain a single concept clearly.
The page has: a title, a short intro, numbered "How it works?" steps, a small flowchart
(sequential boxes, then a yes/no decision that loops back on "No"), a concrete example,
a row of use cases, and one practical note. Keep every string within its word limit —
the page has fixed space. Plain language, no jargon, no markdown.`;

/** Distills a topic/post into the structured content for the notebook-page image. */
export async function generateExplainerSpec(
  domain: string,
  postText: string
): Promise<ExplainerSpec> {
  const { object } = await generateObject({
    model: google(process.env.AI_MODEL ?? "gemini-2.5-flash"),
    schema,
    system: SYSTEM_PROMPT,
    prompt: `Domain: ${domain}

The LinkedIn post this image will accompany:
---
${postText}
---

Extract the single core concept from this post and design the study-note page for it.
The flowchart must describe the concept's actual process, and the decision question must
be the natural "are we done / did it work?" check for that process.`,
  });
  return object;
}
