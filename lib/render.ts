import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { chromium, type Browser } from "playwright-core";
import { IMAGES_DIR } from "./data-dir";
import type {
  ComparisonSpec,
  DosDontsSpec,
  ExplainerSpec,
  IconName,
  KeyPointsSpec,
  MindMapSpec,
  MythsFactsSpec,
  ProcessSpec,
  TimelineSpec,
} from "./explainer";

const INK = "#23357d";
const RED = "#c0392b";
const GREEN = "#1e7d46";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Minimal hand-drawn-style stroke icons, keyed by the names Gemini may pick.
const ICON_SVGS: Record<IconName, string> = {
  pencil: `<path d="M10 38 L14 26 L32 8 L40 16 L22 34 Z"/><path d="M14 26 L22 34"/>`,
  code: `<rect x="5" y="10" width="38" height="28" rx="6"/><text x="24" y="30" text-anchor="middle" style="font:700 15px Kalam;fill:${INK};stroke:none">&lt;/&gt;</text>`,
  search: `<circle cx="20" cy="20" r="11"/><path d="M28 28 L41 41"/>`,
  doc: `<rect x="12" y="5" width="24" height="38" rx="3"/><path d="M17 15 H31 M17 22 H31 M17 29 H27"/>`,
  chart: `<rect x="9" y="26" width="8" height="15"/><rect x="20" y="18" width="8" height="23"/><rect x="31" y="9" width="8" height="32"/>`,
  chat: `<path d="M10 7 H38 Q43 7 43 12 V27 Q43 32 38 32 H22 L13 41 V32 H10 Q5 32 5 27 V12 Q5 7 10 7 Z"/>`,
  bulb: `<circle cx="24" cy="17" r="11"/><path d="M19 31 H29 M20 37 H28 M21 28 L21 31 M27 28 L27 31"/>`,
  target: `<circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="9"/><circle cx="24" cy="24" r="2"/>`,
};

function icon(name: IconName): string {
  return `<svg viewBox="0 0 48 48" width="52" height="52" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ICON_SVGS[name]}</svg>`;
}

/** Vertical flowchart: boxes → decision diamond (No loops back to the top) → final box. */
function flowchartSvg(spec: ProcessSpec): string {
  const width = 430;
  const boxW = 250;
  const boxH = 58;
  const boxX = 55;
  const cx = boxX + boxW / 2;
  const gap = 34;
  const loopX = 400;

  let y = 6;
  const parts: string[] = [];
  const boxCenters: number[] = [];

  const box = (label: string, top: number, h: number) =>
    `<rect x="${boxX}" y="${top}" width="${boxW}" height="${h}" rx="10"/>` +
    `<text x="${cx}" y="${top + h / 2 + 8}" text-anchor="middle" class="ft">${esc(label)}</text>`;
  const arrow = (fromY: number, toY: number) =>
    `<path d="M ${cx} ${fromY} L ${cx} ${toY}" marker-end="url(#arr)"/>`;

  for (const step of spec.flowSteps) {
    parts.push(box(step, y, boxH));
    boxCenters.push(y + boxH / 2);
    y += boxH;
    parts.push(arrow(y, y + gap - 6));
    y += gap;
  }

  // decision diamond
  const dTop = y;
  const dH = 140;
  const dW = 230;
  const dCy = dTop + dH / 2;
  parts.push(
    `<polygon points="${cx},${dTop} ${cx + dW / 2},${dCy} ${cx},${dTop + dH} ${cx - dW / 2},${dCy}"/>`
  );
  const words = spec.decisionQuestion.split(" ");
  const half = Math.ceil(words.length / 2);
  const l1 = words.slice(0, half).join(" ");
  const l2 = words.slice(half).join(" ");
  parts.push(
    `<text x="${cx}" y="${dCy - 4}" text-anchor="middle" class="ft">${esc(l1)}</text>` +
      `<text x="${cx}" y="${dCy + 26}" text-anchor="middle" class="ft">${esc(l2)}</text>`
  );

  // "No" loop back to the first box
  parts.push(
    `<path d="M ${cx + dW / 2} ${dCy} L ${loopX} ${dCy} L ${loopX} ${boxCenters[0]} L ${boxX + boxW + 8} ${boxCenters[0]}" marker-end="url(#arr)"/>` +
      `<text x="${loopX - 22}" y="${dCy - 12}" class="ft lbl">No</text>`
  );

  // "Yes" to the final box
  y = dTop + dH;
  parts.push(arrow(y, y + gap - 6));
  parts.push(`<text x="${cx + 14}" y="${y + gap - 12}" class="ft lbl">Yes</text>`);
  y += gap;
  parts.push(box(`${spec.finalLabel}  ✓`, y, 64));
  y += 64 + 6;

  return `<svg width="${width}" height="${y}" viewBox="0 0 ${width} ${y}" fill="none" stroke="${INK}" stroke-width="2.5">
    <defs><marker id="arr" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
      <path d="M0,0 L8,4.5 L0,9" fill="none" stroke="${INK}" stroke-width="1.8"/>
    </marker></defs>
    <style>.ft{font:24px Kalam;fill:${INK};stroke:none}.lbl{font-weight:700}</style>
    ${parts.join("\n")}
  </svg>`;
}

function processHtml(spec: ProcessSpec): string {
  const steps = spec.steps
    .map((step, i) => `<li><span class="num">${i + 1}.</span> ${esc(step)}</li>`)
    .join("");
  return `<div class="cols">
      <div>
        <h2>How it works?</h2>
        <ol>${steps}</ol>
        <h2>${esc(spec.exampleHeading)}</h2>
        <div class="example">${esc(spec.example)}</div>
      </div>
      <div>${flowchartSvg(spec)}</div>
    </div>`;
}

function comparisonHtml(spec: ComparisonSpec): string {
  const cells = [
    `<div class="vs-cell vs-head"></div>`,
    `<div class="vs-cell vs-head">${esc(spec.leftHeading)}</div>`,
    `<div class="vs-cell vs-head">${esc(spec.rightHeading)}</div>`,
    ...spec.rows.flatMap((row) => [
      `<div class="vs-cell vs-aspect">${esc(row.aspect)}</div>`,
      `<div class="vs-cell">${esc(row.left)}</div>`,
      `<div class="vs-cell">${esc(row.right)}</div>`,
    ]),
  ].join("");
  return `<div class="vs">${cells}</div>
    <div class="punch"><b>Verdict:</b> ${esc(spec.verdict)}</div>`;
}

function timelineHtml(spec: TimelineSpec): string {
  const events = spec.events
    .map(
      (event) => `<div class="tl-event">
        <div class="tl-when">${esc(event.label)}</div>
        <div class="tl-what"><b>${esc(event.heading)}.</b> ${esc(event.detail)}</div>
      </div>`
    )
    .join("");
  return `<div class="tl">${events}</div>
    <div class="punch"><b>Takeaway:</b> ${esc(spec.takeaway)}</div>`;
}

function dosDontsHtml(spec: DosDontsSpec): string {
  const list = (items: string[], mark: string) =>
    items.map((item) => `<li><span class="mark">${mark}</span> ${esc(item)}</li>`).join("");
  return `<div class="dd">
      <div class="dd-col dd-do">
        <div class="dd-head">Do ✓</div>
        <ul>${list(spec.dos, "✓")}</ul>
      </div>
      <div class="dd-col dd-dont">
        <div class="dd-head">Don't ✗</div>
        <ul>${list(spec.donts, "✗")}</ul>
      </div>
    </div>
    <div class="punch"><b>Golden rule:</b> ${esc(spec.goldenRule)}</div>`;
}

function mythsFactsHtml(spec: MythsFactsSpec): string {
  const pairs = spec.pairs
    .map(
      (pair) => `<div class="mf-pair">
        <div class="mf-myth"><span class="mark">✗</span><div><b>Myth:</b> <span class="struck">${esc(pair.myth)}</span></div></div>
        <div class="mf-fact"><span class="mark">✓</span><div><b>Fact:</b> ${esc(pair.fact)}</div></div>
      </div>`
    )
    .join("");
  return `<div class="mf">${pairs}</div>
    <div class="punch"><b>Bottom line:</b> ${esc(spec.bottomLine)}</div>`;
}

/** Horizontal mind map: red center bubble, branch boxes left/right with dashed sub-items. */
function mindMapSvg(spec: MindMapSpec): string {
  const W = 930;
  const H = 540;
  const cx = 465;
  const cy = 270;
  const rx = 150;
  const rectW = 240;
  const rectH = 48;
  const childLine = 30;
  const sideYs: Record<number, number[]> = { 1: [212], 2: [90, 330], 3: [46, 212, 378] };

  const rightCount = Math.ceil(spec.branches.length / 2);
  const leftCount = spec.branches.length - rightCount;
  const parts: string[] = [];

  spec.branches.forEach((branch, i) => {
    const onRight = i < rightCount;
    const slot = onRight ? i : i - rightCount;
    const ys = sideYs[onRight ? rightCount : leftCount] ?? [212];
    const y = ys[slot] ?? 212;
    const x = onRight ? 670 : 20;
    const midY = y + rectH / 2;
    const startX = onRight ? cx + rx - 10 : cx - rx + 10;
    const endX = onRight ? x : x + rectW;
    parts.push(`<path d="M ${startX} ${cy} Q ${(startX + endX) / 2} ${midY} ${endX} ${midY}"/>`);
    parts.push(`<rect x="${x}" y="${y}" width="${rectW}" height="${rectH}" rx="12"/>`);
    parts.push(
      `<text x="${x + rectW / 2}" y="${y + 32}" text-anchor="middle" class="mt">${esc(branch.label)}</text>`
    );
    branch.children.forEach((child, j) => {
      parts.push(
        `<text x="${x + 16}" y="${y + rectH + 26 + j * childLine}" class="mc">- ${esc(child)}</text>`
      );
    });
  });

  parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="60" class="ce"/>`);
  const words = spec.center.split(" ");
  const centerLines =
    spec.center.length > 14 && words.length > 1
      ? [
          words.slice(0, Math.ceil(words.length / 2)).join(" "),
          words.slice(Math.ceil(words.length / 2)).join(" "),
        ]
      : [spec.center];
  centerLines.forEach((line, i) => {
    const y = cy + (i - (centerLines.length - 1) / 2) * 38 + 12;
    parts.push(`<text x="${cx}" y="${y}" text-anchor="middle" class="ct">${esc(line)}</text>`);
  });

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" stroke="${INK}" stroke-width="2.5">
    <style>
      .mt{font:24px Kalam;fill:${INK};stroke:none}
      .mc{font:22px Kalam;fill:${INK};stroke:none}
      .ce{stroke:${RED};stroke-width:3.5}
      .ct{font:700 36px Caveat;fill:${RED};stroke:none}
    </style>
    ${parts.join("\n")}
  </svg>`;
}

function mindMapHtml(spec: MindMapSpec): string {
  return `<div class="map">${mindMapSvg(spec)}</div>
    <div class="punch"><b>Insight:</b> ${esc(spec.insight)}</div>`;
}

function keyPointsHtml(spec: KeyPointsSpec): string {
  const points = spec.points
    .map(
      (point, i) =>
        `<li><span class="num">${i + 1}.</span> <b>${esc(point.heading)}:</b> ${esc(point.detail)}</li>`
    )
    .join("");
  const stat = spec.stat
    ? `<div class="stat"><div class="stat-value">${esc(spec.stat.value)}</div><div class="stat-caption">${esc(spec.stat.caption)}</div></div>`
    : "";
  return `<h2>Key points</h2>
    <ol class="points">${points}</ol>
    ${stat}
    <h2>Why it matters?</h2>
    <div class="why">${esc(spec.whyItMatters)}</div>`;
}

function middleHtml(spec: ExplainerSpec): string {
  switch (spec.layout) {
    case "comparison":
      return comparisonHtml(spec);
    case "keypoints":
      return keyPointsHtml(spec);
    case "timeline":
      return timelineHtml(spec);
    case "dosdonts":
      return dosDontsHtml(spec);
    case "mythsfacts":
      return mythsFactsHtml(spec);
    case "mindmap":
      return mindMapHtml(spec);
    default:
      return processHtml(spec);
  }
}

export function renderExplainerHtml(spec: ExplainerSpec, dateLabel: string): string {
  const rings = Array.from({ length: 24 })
    .map(() => `<div class="ring"></div>`)
    .join("");
  const useCases = spec.useCases
    .map(
      (u) => `<div class="use">${icon(u.icon)}<div class="use-label">${esc(u.label)}</div></div>`
    )
    .join("");
  const usesHeading =
    spec.layout === "keypoints" || spec.layout === "timeline"
      ? "Who should care?"
      : "Where it helps?";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Kalam:wght@300;400;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1080px; height: 1350px; background: #1c1c1f; }
  .page {
    position: absolute; inset: 0 0 0 26px; overflow: hidden;
    background:
      repeating-linear-gradient(to bottom, transparent 0 45px, #dde2ee 45px 47px),
      #fbfaf5;
    padding: 40px 46px 30px 104px;
    color: ${INK};
    font-family: Kalam, cursive;
  }
  .rings { position: absolute; left: 2px; top: 24px; bottom: 0; z-index: 2;
    display: flex; flex-direction: column; gap: 34px; }
  .ring { width: 52px; height: 20px; border: 4px solid #2e2e33; border-radius: 50%;
    transform: rotate(-6deg); background: transparent; }
  .date { position: absolute; top: 34px; right: 52px; font-size: 27px;
    text-decoration: underline; }
  h1 { font-family: Caveat, cursive; font-weight: 700; font-size: 74px;
    text-align: center; text-decoration: underline 3px; text-underline-offset: 10px;
    margin-bottom: 26px; }
  .intro { font-size: 28px; line-height: 47px; margin-bottom: 18px; }
  .cols { display: grid; grid-template-columns: 1fr 434px; column-gap: 14px; }
  h2 { font-family: Caveat, cursive; font-weight: 700; font-size: 42px; color: ${RED};
    text-decoration: underline 2.5px; text-underline-offset: 8px; margin: 14px 0 12px; }
  ol { list-style: none; font-size: 27px; line-height: 47px; }
  .num { display: inline-block; min-width: 36px; }
  .example { font-size: 27px; line-height: 47px; }
  .uses { display: flex; justify-content: space-between; margin-top: 10px; padding: 0 8px; }
  .use { display: flex; flex-direction: column; align-items: center; gap: 8px;
    width: 150px; text-align: center; }
  .use-label { font-size: 25px; line-height: 36px; }
  .note { margin-top: 20px; font-size: 26px; line-height: 45px; color: #1d1d3a; }
  .note b { text-decoration: underline; margin-right: 14px; }
  .vs { display: grid; grid-template-columns: 215px 1fr 1fr; border: 3px solid ${INK};
    border-radius: 14px; overflow: hidden; margin-top: 12px; background: rgba(251, 250, 245, 0.85); }
  .vs-cell { padding: 13px 16px; font-size: 25px; line-height: 38px;
    border-top: 2.5px solid ${INK}; border-left: 2.5px solid ${INK}; }
  .vs-cell:nth-child(-n+3) { border-top: none; }
  .vs-cell:nth-child(3n+1) { border-left: none; }
  .vs-head { font-family: Caveat, cursive; font-weight: 700; font-size: 40px; color: ${RED};
    text-align: center; }
  .vs-aspect { font-weight: 700; }
  .punch { margin-top: 20px; font-size: 27px; line-height: 45px; }
  .punch b { font-family: Caveat, cursive; font-size: 38px; color: ${RED};
    text-decoration: underline; margin-right: 14px; }
  .tl { margin: 16px 0 0 205px; border-left: 4px solid ${INK}; padding: 6px 0 6px 42px; }
  .tl-event { position: relative; margin-bottom: 26px; }
  .tl-event:last-child { margin-bottom: 0; }
  .tl-event::before { content: ""; position: absolute; left: -54px; top: 8px; width: 17px;
    height: 17px; border: 4px solid ${INK}; border-radius: 50%; background: #fbfaf5; }
  .tl-when { position: absolute; left: -250px; top: -4px; width: 180px; text-align: right;
    font-family: Caveat, cursive; font-weight: 700; font-size: 37px; color: ${RED}; }
  .tl-what { font-size: 26px; line-height: 42px; }
  .tl-what b { text-decoration: underline; }
  .dd { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 14px; }
  .dd-col { border: 3px solid; border-radius: 16px; padding: 10px 20px 16px;
    background: rgba(251, 250, 245, 0.85); }
  .dd-do { border-color: ${GREEN}; }
  .dd-dont { border-color: ${RED}; }
  .dd-head { font-family: Caveat, cursive; font-weight: 700; font-size: 42px;
    text-align: center; margin-bottom: 8px; }
  .dd-do .dd-head { color: ${GREEN}; }
  .dd-dont .dd-head { color: ${RED}; }
  .dd ul { list-style: none; font-size: 25px; line-height: 40px; }
  .dd li { margin-bottom: 10px; display: flex; gap: 12px; }
  .mark { font-weight: 700; }
  .dd-do .mark, .mf-fact .mark { color: ${GREEN}; }
  .dd-dont .mark, .mf-myth .mark { color: ${RED}; }
  .mf { margin-top: 8px; }
  .mf-pair { padding: 12px 0 14px; border-bottom: 2.5px dashed #b9c0d8; }
  .mf-pair:last-child { border-bottom: none; }
  .mf-myth, .mf-fact { font-size: 26px; line-height: 42px; display: flex; gap: 14px; }
  .mf-myth { color: ${RED}; }
  .mf-myth b, .mf-fact b { font-family: Caveat, cursive; font-size: 34px; margin-right: 6px; }
  .struck { text-decoration: line-through 2px; }
  .map { display: flex; justify-content: center; margin-top: 6px; }
  .points { list-style: none; font-size: 27px; line-height: 47px; }
  .points b { text-decoration: underline; }
  .stat { display: flex; align-items: baseline; justify-content: center; gap: 24px;
    margin: 14px 0 4px; }
  .stat-value { font-family: Caveat, cursive; font-weight: 700; font-size: 96px; color: ${RED}; }
  .stat-caption { font-size: 26px; line-height: 40px; max-width: 430px; }
  .why { font-size: 27px; line-height: 47px; }
</style></head>
<body>
  <div class="page">
    <div class="date">${esc(dateLabel)}</div>
    <h1>${esc(spec.title)}</h1>
    <div class="intro">${esc(spec.intro)}</div>
    ${middleHtml(spec)}
    <h2>${usesHeading}</h2>
    <div class="uses">${useCases}</div>
    <div class="note"><b>Note:</b>${esc(spec.note)} ☆</div>
  </div>
  <div class="rings">${rings}</div>
</body></html>`;
}

async function launchBrowser(): Promise<Browser> {
  // Vercel serverless has no system Chrome, and playwright-core bundles no browser
  // of its own, so use the Lambda-compatible Chromium from @sparticuz/chromium there.
  // Imported dynamically so the ~50MB binary is only pulled in on Vercel, never in
  // local dev where the system Chrome below is used instead.
  if (process.env.VERCEL) {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return await chromium.launch({
      args: sparticuz.args,
      executablePath: await sparticuz.executablePath(),
      headless: true,
    });
  }
  try {
    // Locally, use the system Chrome to avoid a separate browser download.
    return await chromium.launch({ channel: "chrome" });
  } catch {
    try {
      return await chromium.launch();
    } catch {
      throw new Error(
        "Could not launch a browser for rendering — install Google Chrome or run `npx playwright install chromium`."
      );
    }
  }
}

export type RenderResult = {
  file: string;
  /** Pixels the page content overflows past the fixed 1350px height (0 = fits). */
  overflowPx: number;
};

/** Renders the spec to a PNG in data/images and reports whether the content overflowed the page. */
export async function renderExplainerPng(spec: ExplainerSpec): Promise<RenderResult> {
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).replace(/ /g, "-");

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1350 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.setContent(renderExplainerHtml(spec, dateLabel), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // The page clips overflow (overflow: hidden), so measure it before the screenshot —
    // this is the cheap, deterministic signal that text was cut off.
    const overflowPx = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".page");
      return el ? Math.max(0, Math.round(el.scrollHeight - el.clientHeight)) : 0;
    });
    const buffer = await page.screenshot({ type: "png" });
    await mkdir(IMAGES_DIR, { recursive: true });
    const file = `explainer-${Date.now()}.png`;
    await writeFile(path.join(IMAGES_DIR, file), buffer);
    return { file, overflowPx };
  } finally {
    await browser.close();
  }
}
