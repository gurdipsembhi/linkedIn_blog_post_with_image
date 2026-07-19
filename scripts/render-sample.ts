import { renderExplainerPng } from "../lib/render";
import type { ExplainerSpec } from "../lib/explainer";

const sample: ExplainerSpec = {
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
};

renderExplainerPng(sample).then((file) => console.log(`rendered: data/images/${file}`));
