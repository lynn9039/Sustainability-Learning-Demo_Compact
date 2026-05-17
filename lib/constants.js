/** @typedef {{ categories?: string[]; impactDimensions?: string[] }} FocusAreas */

/**
 * @typedef {Object} ExtractedPayload
 * @property {"link"|"text"|"file"|"youtube"} inputType
 * @property {string} content
 * @property {string} [sourceUrl]
 * @property {string} [title]
 * @property {string} [author]
 * @property {string} [publisher]
 * @property {string} [publishedDate]
 * @property {string} [heroImageUrl]
 * @property {FocusAreas} [focusAreas]
 * @property {{ pages?: number; words?: number; videoSeconds?: number }} [sourceLength]
 * @property {"en"|"zh"} [language]
 * @property {string} [generatedOn]
 */

export const DEFAULT_MODEL_ID = "claude-sonnet-4-5-20250929";
export const MAX_TOKENS = 16_000;
export const DEMO_MAX_CONTENT_CHARS = 4_000;

/** Vercel Hobby serverless request body limit */
export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

/** Rate limit: attempts per IP per sliding 24h (after Turnstile passes, before LLM) */
export const RATE_LIMIT_PER_DAY = 3;

/** Language detection: CJK ratio above this → zh */
export const CJK_RATIO_THRESHOLD = 0.3;

export const LANGUAGE_SAMPLE_BYTES = 2048;

/** Minimum extracted content length to call LLM (else VALIDATION_ERROR, no LLM) */
export const MIN_CONTENT_CHARS = 80;

/** Confidential marker scan window (markers usually appear at document start) */
export const CONFIDENTIAL_CHECK_CHARS = 500;

export const FETCH_TIMEOUT_MS = 20_000;
export const FETCH_MAX_BYTES = 3 * 1024 * 1024;

export const ERROR = {
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  MISSING_TURNSTILE: "MISSING_TURNSTILE",
  TURNSTILE_FAILED: "TURNSTILE_FAILED",
  RATE_LIMIT: "RATE_LIMIT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  FETCH_FAILED: "FETCH_FAILED",
  LOGIN_WALL: "LOGIN_WALL",
  NO_TRANSCRIPT: "NO_TRANSCRIPT",
  FILE_PARSE_FAILED: "FILE_PARSE_FAILED",
  CONFIDENTIAL: "CONFIDENTIAL",
  GENERATION_FAILED: "GENERATION_FAILED",
};

/** Default HTTP status when returning { error } */
export const ERROR_STATUS = {
  [ERROR.METHOD_NOT_ALLOWED]: 405,
  [ERROR.MISSING_TURNSTILE]: 400,
  [ERROR.TURNSTILE_FAILED]: 400,
  [ERROR.RATE_LIMIT]: 429,
  [ERROR.VALIDATION_ERROR]: 400,
  [ERROR.FILE_TOO_LARGE]: 413,
  [ERROR.UNSUPPORTED_FILE_TYPE]: 400,
  [ERROR.FETCH_FAILED]: 400,
  [ERROR.LOGIN_WALL]: 400,
  [ERROR.NO_TRANSCRIPT]: 400,
  [ERROR.FILE_PARSE_FAILED]: 400,
  [ERROR.CONFIDENTIAL]: 400,
  [ERROR.GENERATION_FAILED]: 502,
};

export const INPUT_TYPES = ["link", "text", "file", "youtube"];

/** MIME → internal handler key */
export const MIME_HANDLERS = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "plain",
  "text/markdown": "plain",
};

export const ALLOWED_EXTENSIONS = {
  pdf: [".pdf"],
  docx: [".docx"],
  pptx: [".pptx"],
  plain: [".txt", ".md", ".markdown"],
};

export const CONFIDENTIAL_MARKERS = [
  "confidential",
  "internal use only",
  "do not distribute",
  "strictly private",
  "仅供内部",
  "保密",
  "请勿外传",
];

/** Default English hints for API errors (frontend may localize by error code) */
export const ERROR_HINTS = {
  [ERROR.VALIDATION_ERROR]:
    "The text is too short to analyze. Please paste more content and try again.",
  [ERROR.CONFIDENTIAL]:
    "This document appears to be marked confidential. We cannot generate a public learning page from it.",
};
