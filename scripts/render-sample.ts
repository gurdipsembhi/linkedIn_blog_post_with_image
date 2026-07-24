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
  {
    layout: "timeline",
    title: "The Rise of LLMs",
    intro:
      "Large language models did not appear overnight. A few key breakthroughs turned a research idea into the technology reshaping every industry today.",
    events: [
      { label: "2017", heading: "The Transformer", detail: "'Attention Is All You Need' replaces recurrence with self-attention" },
      { label: "2018", heading: "BERT & GPT", detail: "Pre-training on huge text corpora becomes the standard" },
      { label: "2020", heading: "GPT-3", detail: "175B parameters shows few-shot learning at scale" },
      { label: "2022", heading: "ChatGPT", detail: "RLHF makes models genuinely usable for the public" },
      { label: "2024+", heading: "Agents", detail: "Models start using tools and acting autonomously" },
    ],
    takeaway: "Each leap came from scale plus a new training idea, not one alone.",
    useCases: [
      { icon: "search", label: "Researchers" },
      { icon: "code", label: "Engineers" },
      { icon: "bulb", label: "Founders" },
      { icon: "chart", label: "Investors" },
    ],
    note: "The gap between breakthroughs is shrinking — plan for capability, not just today's limits.",
  },
  {
    layout: "dosdonts",
    title: "Prompting Best Practices",
    intro:
      "Most bad AI output comes from bad prompts, not bad models. A few habits separate reliable results from frustrating ones.",
    dos: [
      "Give clear role and context",
      "Show one or two examples",
      "Ask for a specific format",
      "Break big tasks into steps",
      "Tell it to say 'I don't know'",
    ],
    donts: [
      "Pile five questions into one",
      "Assume it remembers earlier chats",
      "Trust facts without checking",
      "Use vague words like 'good'",
      "Skip testing the prompt",
    ],
    goldenRule: "Be specific about what you want and how you want it — precision in, precision out.",
    useCases: [
      { icon: "pencil", label: "Writing" },
      { icon: "code", label: "Coding" },
      { icon: "search", label: "Research" },
      { icon: "chat", label: "Chatbots" },
    ],
    note: "Save prompts that work as templates — you will reuse them far more than you expect.",
  },
  {
    layout: "mythsfacts",
    title: "AI Myths, Debunked",
    intro:
      "AI is surrounded by hype and fear in equal measure. Separating what is real from what is imagined helps you make better decisions.",
    pairs: [
      { myth: "AI understands like a human does", fact: "It predicts likely text from patterns, without real understanding" },
      { myth: "More data always means better AI", fact: "Data quality and relevance matter far more than raw volume" },
      { myth: "AI will replace all jobs soon", fact: "It mostly automates tasks, reshaping jobs rather than erasing them" },
      { myth: "AI answers are always objective", fact: "It inherits the biases in its training data" },
    ],
    bottomLine: "Treat AI as a powerful, fallible tool — not an oracle and not magic.",
    useCases: [
      { icon: "bulb", label: "Leaders" },
      { icon: "doc", label: "Educators" },
      { icon: "chat", label: "Teams" },
      { icon: "target", label: "Buyers" },
    ],
    note: "When someone makes a big AI claim, ask what data and evidence it rests on.",
  },
  {
    layout: "mindmap",
    title: "The MLOps Landscape",
    intro:
      "Shipping machine learning to production is far more than training a model. MLOps covers everything around the model that keeps it working.",
    center: "MLOps",
    branches: [
      { label: "Data", children: ["Versioning", "Validation", "Pipelines"] },
      { label: "Training", children: ["Experiments", "Tuning", "Registry"] },
      { label: "Serving", children: ["APIs", "Batch", "Scaling"] },
      { label: "Monitoring", children: ["Drift", "Latency", "Alerts"] },
      { label: "Governance", children: ["Access", "Audit", "Lineage"] },
      { label: "CI/CD", children: ["Testing", "Rollout"] },
    ],
    insight: "The model is maybe 10% of the work — the other 90% is the system around it.",
    useCases: [
      { icon: "code", label: "ML Engineers" },
      { icon: "chart", label: "Data Teams" },
      { icon: "target", label: "Platform Leads" },
      { icon: "doc", label: "Compliance" },
    ],
    note: "Start with monitoring and data versioning — they catch the failures that hurt most in production.",
  },
];

async function main() {
  for (const sample of samples) {
    const { file, overflowPx } = await renderExplainerPng(sample);
    const overflow = overflowPx > 0 ? ` (overflow ${overflowPx}px!)` : "";
    console.log(`rendered (${sample.layout}): data/images/${file}${overflow}`);
  }
}
main();
