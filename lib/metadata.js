/**
 * @param {string} content
 * @param {"en"|"zh"} language
 * @returns {number}
 */
export function countWords(content, language) {
  if (!content) return 0;
  const trimmed = content.trim();
  if (!trimmed) return 0;

  if (language === "zh") {
    return trimmed.replace(/\s+/g, "").length;
  }
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Rough page estimate when page count is unknown (≈300 words or 900 CJK chars per page).
 * @param {number} words
 * @param {"en"|"zh"} language
 * @returns {number | undefined}
 */
export function estimatePages(words, language) {
  if (words <= 0) return undefined;
  const perPage = language === "zh" ? 900 : 300;
  return Math.max(1, Math.round(words / perPage));
}

/**
 * @param {string} content
 * @param {"en"|"zh"} language
 * @param {{ pages?: number; videoSeconds?: number }} [hints]
 * @returns {{ words?: number; pages?: number; videoSeconds?: number }}
 */
export function estimateSourceLength(content, language, hints = {}) {
  const words = countWords(content, language);
  /** @type {{ words?: number; pages?: number; videoSeconds?: number }} */
  const length = {};

  if (words > 0) length.words = words;
  if (hints.videoSeconds != null && hints.videoSeconds > 0) {
    length.videoSeconds = Math.round(hints.videoSeconds);
  }
  if (hints.pages != null && hints.pages > 0) {
    length.pages = Math.round(hints.pages);
  } else if (words > 0 && !length.videoSeconds) {
    const pages = estimatePages(words, language);
    if (pages) length.pages = pages;
  }

  return length;
}

/**
 * @param {string} content
 * @param {string} [providedTitle]
 * @param {string} [sourceUrl]
 * @returns {string}
 */
export function inferTitle(content, providedTitle, sourceUrl) {
  if (providedTitle && providedTitle.trim()) return providedTitle.trim();

  if (content) {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const line of lines.slice(0, 8)) {
      if (line.length >= 8 && line.length <= 160 && !/^https?:\/\//i.test(line)) {
        return line;
      }
    }
    const snippet = content.trim().slice(0, 120).replace(/\s+/g, " ");
    if (snippet.length >= 8) return snippet + (content.length > 120 ? "…" : "");
  }

  if (sourceUrl) {
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
      return host;
    } catch {
      /* ignore */
    }
  }

  return "Untitled";
}

/**
 * Merge extraction fields + language into the Claude payload shape.
 * @param {Object} params
 * @param {"link"|"text"|"file"|"youtube"} params.inputType
 * @param {string} params.content
 * @param {"en"|"zh"} params.language
 * @param {string} [params.sourceUrl]
 * @param {string} [params.title]
 * @param {string} [params.author]
 * @param {string} [params.publisher]
 * @param {string} [params.publishedDate]
 * @param {string} [params.heroImageUrl]
 * @param {import("./constants.js").FocusAreas} [params.focusAreas]
 * @param {{ pages?: number; videoSeconds?: number }} [params.lengthHints]
 * @returns {import("./constants.js").ExtractedPayload}
 */
export function buildPayload(params) {
  const {
    inputType,
    content,
    language,
    sourceUrl,
    title,
    author,
    publisher,
    publishedDate,
    heroImageUrl,
    focusAreas,
    lengthHints,
  } = params;

  const sourceLength = estimateSourceLength(content, language, lengthHints);

  /** @type {import("./constants.js").ExtractedPayload} */
  const payload = {
    inputType,
    content,
    language,
    title: inferTitle(content, title, sourceUrl),
    sourceLength,
  };

  if (sourceUrl) payload.sourceUrl = sourceUrl;
  if (author) payload.author = author;
  if (publisher) payload.publisher = publisher;
  if (publishedDate) payload.publishedDate = publishedDate;
  if (heroImageUrl) payload.heroImageUrl = heroImageUrl;
  if (focusAreas && typeof focusAreas === "object") payload.focusAreas = focusAreas;

  return payload;
}
