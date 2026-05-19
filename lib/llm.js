import Anthropic from "@anthropic-ai/sdk";
import {
  COMPACT_ANTHROPIC_TIMEOUT_MS,
  COMPACT_MAX_TOKENS,
  DEFAULT_MODEL_ID,
  ERROR,
  GENERATION_MODE,
  MAX_TOKENS,
} from "./constants.js";
import { buildAnthropicRequest } from "./prompts.js";

/**
 * @param {import("@anthropic-ai/sdk").Message} message
 * @returns {string}
 */
function extractTextFromMessage(message) {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function stripJsonFences(raw) {
  let text = raw.trim();
  const match = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (match) text = match[1].trim();
  return text;
}

function parseCompactParts(raw) {
  const parsed = JSON.parse(stripJsonFences(raw));
  const required = ["pageTitle", "sourceMeta", "tab1Html", "tab2Html", "tab3Html"];
  for (const key of required) {
    if (typeof parsed[key] !== "string" || !parsed[key].trim()) {
      throw new Error(`Compact JSON missing ${key}`);
    }
  }
  return parsed;
}

/**
 * Call Claude to produce a complete HTML learning page.
 *
 * @param {import("./constants.js").ExtractedPayload} payload
 * @returns {Promise<{ ok: true; text: string } | { ok: false; reason: string; code?: string }>}
 */
export async function generateLearningPage(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "ANTHROPIC_API_KEY is not configured" };
  }

  const { system, messages } = buildAnthropicRequest(payload);

  try {
    const client = new Anthropic({
      apiKey,
      ...(GENERATION_MODE === "compact"
        ? { timeout: COMPACT_ANTHROPIC_TIMEOUT_MS, maxRetries: 0 }
        : {}),
    });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL_ID,
      max_tokens: GENERATION_MODE === "compact" ? COMPACT_MAX_TOKENS : MAX_TOKENS,
      system,
      messages,
    });

    if (response.stop_reason === "max_tokens") {
      return {
        ok: false,
        reason: "Model hit max_tokens before finishing the HTML document",
      };
    }

    const text = extractTextFromMessage(response);
    if (!text) {
      return { ok: false, reason: "Model returned no text content" };
    }

    return { ok: true, text };
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "Anthropic API request failed";
    if (/timeout|timed out/i.test(reason)) {
      return { ok: false, code: ERROR.GENERATION_TIMEOUT, reason };
    }
    return { ok: false, reason };
  }
}

/**
 * Compact mode: Claude returns HTML fragments as JSON; Node fills the full template.
 *
 * @param {import("./constants.js").ExtractedPayload} payload
 * @returns {Promise<{ ok: true; parts: { pageTitle: string; sourceMeta: string; tab1Html: string; tab2Html: string; tab3Html: string } } | { ok: false; reason: string; code?: string }>}
 */
export async function generateLearningPageParts(payload) {
  const result = await generateLearningPage(payload);
  if (!result.ok) return result;

  try {
    return { ok: true, parts: parseCompactParts(result.text) };
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "Could not parse compact JSON";
    return { ok: false, reason };
  }
}
