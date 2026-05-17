import { CJK_RATIO_THRESHOLD, LANGUAGE_SAMPLE_BYTES } from "./constants.js";

/** CJK Unified Ideographs + common punctuation ranges */
const CJK_RE =
  /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/g;

/**
 * Detect page language from the start of extracted content.
 * CJK ratio > 30% in the first 2KB → zh (Simplified Chinese UI copy), otherwise en.
 * No zh-Hant / Traditional branch — Claude uses skill §6 Simplified strings when zh.
 *
 * @param {string} content
 * @returns {"en" | "zh"}
 */
export function detectLanguage(content) {
  if (!content || typeof content !== "string") return "en";

  const sample = content.slice(0, LANGUAGE_SAMPLE_BYTES);
  const meaningful = sample.replace(/\s+/g, "");
  if (meaningful.length === 0) return "en";

  const cjkMatches = meaningful.match(CJK_RE);
  const cjkCount = cjkMatches ? cjkMatches.length : 0;
  const ratio = cjkCount / meaningful.length;

  return ratio > CJK_RATIO_THRESHOLD ? "zh" : "en";
}
