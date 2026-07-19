import { renderExplainerPng } from "../lib/render";
import type { ExplainerSpec } from "../lib/explainer";

const samples: ExplainerSpec[] = [
  {
    layout: "process",
    title: "Loop Prompt",
    intro:
      "Instead of asking AI once and accepting the first answer, loop prompting helps AI improve its own output step by step until we get the best result.",
    steps: [
      "Generate an answer",
      "Review the answer",
      "Find issues / gaps",
      "Improve the answer",
      "Score the answer (1-10)",
      "If score < target, repeat",
      "If score >= target, return final answer",
    ],
    flowSteps: ["Generate Answer", "Review", "Improve", "Score (1-10)"],
    decisionQuestion: "Score >= Target?",
    finalLabel: "Final Answer",
    exampleHeading: "Example Prompt:",
    example:
      '"Generate the answer. Review it for mistakes and gaps. Improve it. Score it from 1 to 10. If the score is below 9.5, repeat the process. Stop when the score is 9.5 or higher or after 5 iterations."',
    useCases: [
      { icon: "pencil", label: "Content Writing" },
      { icon: "code", label: "Code Generation" },
      { icon: "search", label: "Research & Analysis" },
      { icon: "doc", label: "Resume & Docs" },
      { icon: "chart", label: "Business Strategy" },
      { icon: "chat", label: "Prompt Engineering" },
    ],
    note: "Always set a clear stopping condition (like target score or max iterations) to avoid unnecessary loops.",
  },
  {
    layout: "comparison",
    title: "RAG vs Fine-Tuning",
    intro:
      "Both make a language model better at your domain, but they work very differently. Knowing when to use which saves months of effort and a lot of compute budget.",
    leftHeading: "RAG",
    rightHeading: "Fine-Tuning",
    rows: [
      { aspect: "How", left: "Retrieves documents at query time", right: "Retrains model weights on your data" },
      { aspect: "Freshness", left: "Always current — just update the docs", right: "Frozen at training time" },
      { aspect: "Cost", left: "Cheap to start, pay per query", right: "Expensive upfront training runs" },
      { aspect: "Sources", left: "Can cite where answers came from", right: "No traceable sources" },
      { aspect: "Best for", left: "Facts and changing knowledge", right: "Style, format and tone" },
    ],
    verdict: "Start with RAG for knowledge; fine-tune only when you need behavior, not facts.",
    useCases: [
      { icon: "search", label: "Enterprise Search" },
      { icon: "chat", label: "Support Bots" },
      { icon: "doc", label: "Doc Assistants" },
      { icon: "code", label: "Code Helpers" },
      { icon: "target", label: "Brand Voice" },
    ],
    note: "The two combine well: RAG for the facts, a light fine-tune for the voice.",
  },
  {
    layout: "keypoints",
    title: "The AI Premium",
    intro:
      "A Yale-led study analyzed real-world AI usage at unprecedented scale and found financial markets are already pricing in who benefits from AI adoption.",
    points: [
      { heading: "Massive dataset", detail: "380 trillion AI tokens from OpenRouter, Jan 2024 to Apr 2026" },
      { heading: "AI Premium", detail: "High-AI-exposure firms beat low-exposure ones every week" },
      { heading: "Beyond tech", detail: "Retail, consumer durables and manufacturers benefit too" },
      { heading: "Agentic shift", detail: "Autonomous agents grew to over half of all tokens" },
    ],
    stat: { value: "0.64%", caption: "extra stock return per week for AI-exposed firms" },
    whyItMatters:
      "Markets now reward proximity to frontier AI — how your company uses AI is becoming a valuation question.",
    useCases: [
      { icon: "chart", label: "Investors" },
      { icon: "target", label: "Strategy Teams" },
      { icon: "bulb", label: "Founders" },
      { icon: "doc", label: "Analysts" },
    ],
    note: "Exposure was measured from actual AI consumption, not from what companies claim in earnings calls.",
  },
];

async function main() {
  for (const sample of samples) {
    const file = await renderExplainerPng(sample);
    console.log(`rendered (${sample.layout}): data/images/${file}`);
  }
}
main();
