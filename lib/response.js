import { ERROR, ERROR_HINTS, ERROR_STATUS } from "./constants.js";

/**
 * @param {import("http").ServerResponse} res
 * @param {number} status
 * @param {Record<string, unknown>} body
 */
export function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

/**
 * @param {import("http").ServerResponse} res
 * @param {string} errorCode
 * @param {{ hint?: string; status?: number; extra?: Record<string, unknown> }} [opts]
 */
export function sendError(res, errorCode, opts = {}) {
  const status = opts.status ?? ERROR_STATUS[errorCode] ?? 400;
  const hint =
    opts.hint ??
    ERROR_HINTS[errorCode] ??
    "Something went wrong. Please try again.";
  jsonResponse(res, status, {
    error: errorCode,
    hint,
    ...opts.extra,
  });
}

/**
 * @param {import("http").ServerResponse} res
 * @param {string} html
 */
export function sendHtmlSuccess(res, html) {
  jsonResponse(res, 200, { html });
}

/**
 * Strip optional markdown fences Claude may wrap around HTML.
 * @param {string} raw
 * @returns {string}
 */
export function stripMarkdownFences(raw) {
  let text = raw.trim();
  const fence = /^```(?:html)?\s*\n?([\s\S]*?)\n?```\s*$/i;
  const match = text.match(fence);
  if (match) text = match[1].trim();
  return text;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isValidHtmlDocument(text) {
  return /^<!doctype\s+html/i.test(text.trim());
}

/**
 * @param {import("http").ServerResponse} res
 * @param {string} rawModelText
 * @returns {boolean} true if success was sent
 */
export function sendGenerationResult(res, rawModelText) {
  const html = stripMarkdownFences(rawModelText);
  if (!isValidHtmlDocument(html)) {
    sendError(res, ERROR.GENERATION_FAILED, {
      hint:
        "The model did not return a complete HTML page. Please try again or paste the text directly.",
    });
    return false;
  }
  sendHtmlSuccess(res, html);
  return true;
}
