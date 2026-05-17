import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL_ID, MAX_TOKENS } from "./constants.js";
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

/**
 * Call Claude to produce a complete HTML learning page.
 *
 * @param {import("./constants.js").ExtractedPayload} payload
 * @returns {Promise<{ ok: true; text: string } | { ok: false; reason: string }>}
 */
export async function generateLearningPage(payload) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "ANTHROPIC_API_KEY is not configured" };
  }

  const { system, messages } = buildAnthropicRequest(payload);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL_ID,
      max_tokens: MAX_TOKENS,
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
    return { ok: false, reason };
  }
}
