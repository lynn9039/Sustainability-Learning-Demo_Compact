import {
  CONFIDENTIAL_CHECK_CHARS,
  CONFIDENTIAL_MARKERS,
  DEMO_MAX_CONTENT_CHARS,
  ERROR,
  ERROR_HINTS,
  MIN_CONTENT_CHARS,
} from "../lib/constants.js";
import { extractByInputType } from "../lib/extract/index.js";
import { detectLanguage } from "../lib/language.js";
import { generateLearningPage } from "../lib/llm.js";
import { buildPayload } from "../lib/metadata.js";
import { parseMultipartRequest } from "../lib/multipart.js";
import { consumeRateLimitAttempt, getClientIp } from "../lib/rate-limit.js";
import { sendError, sendGenerationResult } from "../lib/response.js";
import { verifyTurnstile } from "../lib/turnstile.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

/** @type {Record<string, string>} */
const EXTRACT_HINTS = {
  [ERROR.FETCH_FAILED]:
    "We could not read this page. Try pasting the article text directly, or use a different link.",
  [ERROR.LOGIN_WALL]:
    "LinkedIn blocks automated access. Please copy and paste the post text into the “Paste text” tab.",
  [ERROR.NO_TRANSCRIPT]:
    "No captions are available for this video. Try another video or paste a transcript.",
  [ERROR.FILE_PARSE_FAILED]:
    "We could not extract text from this file. Try a different format or paste the content directly.",
  [ERROR.FILE_TOO_LARGE]:
    "File is too large (max 4.5 MB on this plan). Try a smaller file or paste the text.",
  [ERROR.UNSUPPORTED_FILE_TYPE]:
    "Unsupported file type. Use PDF, DOCX, PPTX, TXT, or MD.",
};

/**
 * @param {string} content
 */
function isConfidentialContent(content) {
  const head = content.slice(0, CONFIDENTIAL_CHECK_CHARS).toLowerCase();
  return CONFIDENTIAL_MARKERS.some((marker) =>
    head.includes(marker.toLowerCase()),
  );
}

/**
 * @param {unknown} err
 * @returns {err is Error & { code: string }}
 */
function hasErrorCode(err) {
  return (
    err instanceof Error &&
    "code" in err &&
    typeof err.code === "string"
  );
}

/**
 * @param {import("http").IncomingMessage} req
 * @param {import("http").ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendError(res, ERROR.METHOD_NOT_ALLOWED, {
      hint: "Use POST with multipart/form-data.",
    });
    return;
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    sendError(res, ERROR.VALIDATION_ERROR, {
      hint: "Content-Type must be multipart/form-data.",
    });
    return;
  }

  try {
    const form = await parseMultipartRequest(req);
    const clientIp = getClientIp(req);

    const turnstile = await verifyTurnstile(form.turnstileToken, clientIp);
    if (!turnstile.ok) {
      sendError(res, ERROR.TURNSTILE_FAILED, {
        hint: "Captcha verification failed. Please refresh and try again.",
      });
      return;
    }

    const extracted = await extractByInputType({
      inputType: form.inputType,
      url: form.url,
      text: form.text,
      fileBuffer: form.fileBuffer,
      mimeType: form.mimeType,
      filename: form.filename,
    });

    if (extracted.content.length < MIN_CONTENT_CHARS) {
      sendError(res, ERROR.VALIDATION_ERROR, {
        hint: ERROR_HINTS[ERROR.VALIDATION_ERROR],
      });
      return;
    }

    if (isConfidentialContent(extracted.content)) {
      sendError(res, ERROR.CONFIDENTIAL, {
        hint: ERROR_HINTS[ERROR.CONFIDENTIAL],
      });
      return;
    }

    const rate = await consumeRateLimitAttempt(clientIp);
    if (!rate.allowed) {
      sendError(res, ERROR.RATE_LIMIT, {
        hint: "You have reached the limit of 3 learning pages per day for this IP. Please try again tomorrow.",
      });
      return;
    }

    const language = detectLanguage(extracted.content);
    const contentForClaude =
      extracted.content.length > DEMO_MAX_CONTENT_CHARS
        ? `${extracted.content.slice(0, DEMO_MAX_CONTENT_CHARS)}\n\n[Source truncated for demo runtime.]`
        : extracted.content;
    const payload = buildPayload({
      inputType: form.inputType,
      content: contentForClaude,
      language,
      sourceUrl: extracted.sourceUrl ?? form.url,
      title: extracted.title,
      author: extracted.author,
      heroImageUrl: extracted.heroImageUrl,
      focusAreas: form.focusAreas,
      lengthHints: {
        pages: extracted.pages,
        videoSeconds: extracted.videoSeconds,
      },
    });
    payload.generatedOn = new Date().toISOString().slice(0, 10);

    console.info(
      `[generate] calling Claude model for ${form.inputType}, chars=${contentForClaude.length}`,
    );
    const claudeStartedAt = Date.now();
    const llmResult = await generateLearningPage(payload);
    const claudeElapsedMs = Date.now() - claudeStartedAt;
    if (!llmResult.ok) {
      console.warn(
        `[generate] Claude failed after ${claudeElapsedMs}ms: ${llmResult.reason}`,
      );
      sendError(res, ERROR.GENERATION_FAILED, { hint: llmResult.reason });
      return;
    }

    console.info(`[generate] Claude returned HTML candidate after ${claudeElapsedMs}ms`);
    sendGenerationResult(res, llmResult.text);
  } catch (err) {
    if (hasErrorCode(err)) {
      const hint =
        EXTRACT_HINTS[err.code] ||
        err.message ||
        ERROR_HINTS[err.code] ||
        "Request failed.";
      sendError(res, err.code, { hint });
      return;
    }

    console.error("[generate]", err);
    sendError(res, ERROR.GENERATION_FAILED, {
      hint:
        process.env.VERCEL_ENV === "production"
          ? "An unexpected error occurred. Please try again."
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred. Please try again.",
    });
  }
}
