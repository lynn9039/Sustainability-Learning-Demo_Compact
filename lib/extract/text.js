import { ERROR } from "../constants.js";

/**
 * Use pasted plain text as source content.
 *
 * @param {string} text
 * @returns {{ content: string; sourceUrl?: string }}
 */
export function extractText(text) {
  const content = (text || "").replace(/\r\n/g, "\n").trim();

  if (!content) {
    const err = new Error("Pasted text is empty");
    err.code = ERROR.VALIDATION_ERROR;
    throw err;
  }

  return { content };
}
