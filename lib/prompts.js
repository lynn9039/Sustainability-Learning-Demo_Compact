import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * System prompt = skill-prompt.md + template.html (per skill §12).
 * @returns {string}
 */
export function loadSystemPrompt() {
  if (cachedSystem) return cachedSystem;

  const skillPath = join(ROOT, "assets", "skill-prompt.md");
  const templatePath = join(ROOT, "assets", "template.html");

  const skill = stripFrontmatter(
    readFileSync(skillPath, "utf8"),
  );
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
    "Runtime note for this public Vercel demo: produce a complete, valid HTML document, but keep it compact so the request can finish reliably. Do not omit any required tab, card, reading-time meter, footer, or template structure. Use concise prose: Tab 1 summary 120-180 words; Tab 2 with 3-4 short cards/sections; Tab 3 with 3 short sections plus 2 open questions. Avoid optional diagrams unless essential. Target a complete page rather than exhaustive coverage.",
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
