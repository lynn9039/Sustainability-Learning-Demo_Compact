import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATION_MODE } from "./constants.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {string | null} */
let cachedSystem = null;

/**
 * Remove YAML frontmatter from skill-prompt.md if present.
 * @param {string} raw
 */
function stripFrontmatter(raw) {
  if (!raw.startsWith("---")) return raw;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return raw;
  return raw.slice(end + 4).trimStart();
}

const COMPACT_SKILL_PROMPT = `
You are a sustainability analyst and learning designer. Turn the provided structured payload into compact HTML fragments for a public Vercel demo.

Output contract:
- Return only valid JSON. No markdown fences, no prose.
- JSON shape exactly:
  {
    "pageTitle": "string",
    "sourceMeta": "string",
    "tab1Html": "string",
    "tab2Html": "string",
    "tab3Html": "string"
  }
- The backend will insert these fragments into the shipped HTML template. Do not output <!doctype html>, <html>, <head>, CSS, JS, footer, or tab buttons.
- Language: if payload.language is "zh", write Simplified Chinese UI/content; otherwise English.
- Use template classes only: card, gauges, gauge, gauge-label, gauge-level, gauge-area, dots, dot, on, gauge-note, time-card, time-icon, time-value, time-sub, key-facts, fact, fact-value, fact-label, callout.
- Every reading-time card must include the template clock structure: a time-card element containing time-icon with a small inline clock SVG, plus time-value and time-sub. Never write only "1 min"; label what the time is for. In all three tabs, put the full label on the main time-value line (for example "Estimated reading time · source" or "Estimated reading time · this analysis"). Put the duration/details on the next smaller time-sub line (for example "1 min read based on the provided source only"). Do not combine the label and duration on one line.

Compact public-demo content rules:
- Optimize for a Vercel Hobby 60-second function. Be useful, not exhaustive.
- Tab 1 order: difficulty gauges, source reading-time card, content summary.
- Tab 1 difficulty card is mandatory and must contain exactly two gauges inside a gauges container: (1) Reading / linguistic difficulty and (2) Domain knowledge required. Each gauge must show a level, 5 dots, and a one-sentence reason.
- Tab 1 source reading-time card must clearly show "Estimated reading time · source" (or "预计阅读时间 · 原文") as the time-value main line, with a time-sub below such as "2 min read based on the provided source only".
- Tab 1 summary: 90-140 English words or equivalent concise Chinese.
- Tab 2: start with a compact analysis reading-time card that clearly says "Estimated reading time · this analysis" (or "预计阅读时间 · 本分析"), then exactly 3 concise sections/cards.
- Tab 3: start with a compact analysis reading-time card that clearly says "Estimated reading time · this analysis" (or "预计阅读时间 · 本分析"), then exactly 4 same-level sections. The first 3 sections are concise action/foresight sections. The 4th section is titled "Open Questions" (or "待解之问"). Use the same heading tag and same visual level for all 4 section titles. Do not lower the first 3 section titles to make them match Open Questions; instead, raise Open Questions to match the first 3. Under "Open Questions", render exactly two questions as normal-size paragraphs or list items. Do not make each question a large bold heading.
- Avoid optional diagrams, tables, long quote blocks, extended stakeholder lists, and exhaustive methodology discussion.
- Every specific number must come from payload.content. Do not fabricate statistics.
- Keep direct quotes under 30 consecutive words.
`.trim();

/**
 * System prompt = skill-prompt.md + template.html (per skill §12).
 * @returns {string}
 */
export function loadSystemPrompt() {
  if (cachedSystem) return cachedSystem;

  const skillPath = join(ROOT, "assets", "skill-prompt.md");
  const templatePath = join(ROOT, "assets", "template.html");

  const skill =
    GENERATION_MODE === "compact"
      ? COMPACT_SKILL_PROMPT
      : stripFrontmatter(readFileSync(skillPath, "utf8"));

  if (GENERATION_MODE === "compact") {
    cachedSystem = skill;
    return cachedSystem;
  }

  const template = readFileSync(templatePath, "utf8");

  cachedSystem = [
    skill,
    "",
    "---",
    "",
    "## Companion HTML template",
    "",
    "Fill every `{{PLACEHOLDER}}` in the template below. Do not modify embedded CSS or JavaScript. Use the payload `generatedOn` value for `{{GENERATED_ON}}`; never copy the example date from the template comments.",
    "",
    GENERATION_MODE === "compact"
      ? "Compact mode is active: follow the compact public-demo rules above strictly so the response can complete under Vercel Hobby runtime."
      : "Full mode is active: follow the full skill prompt above.",
    "",
    template,
  ].join("\n");

  return cachedSystem;
}

/**
 * @param {import("./constants.js").ExtractedPayload} payload
 * @returns {string}
 */
export function buildUserMessage(payload) {
  return JSON.stringify(payload, null, 2);
}

/**
 * @param {import("./constants.js").ExtractedPayload} payload
 * @returns {{ system: string; messages: { role: "user"; content: string }[] }}
 */
export function buildAnthropicRequest(payload) {
  return {
    system: loadSystemPrompt(),
    messages: [{ role: "user", content: buildUserMessage(payload) }],
  };
}
