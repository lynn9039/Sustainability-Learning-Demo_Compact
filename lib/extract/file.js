import {
  ALLOWED_EXTENSIONS,
  ERROR,
  MAX_UPLOAD_BYTES,
  MIME_HANDLERS,
} from "../constants.js";
import { extractDocxText } from "./docx.js";
import { extractPdfText } from "./pdf.js";
import { extractPlainText } from "./plain.js";
import { extractPptxText } from "./pptx.js";

/**
 * @param {string} filename
 * @returns {string}
 */
function extensionOf(filename) {
  const i = filename.lastIndexOf(".");
  if (i === -1) return "";
  return filename.slice(i).toLowerCase();
}

/**
 * @param {string} mimeType
 * @param {string} filename
 * @returns {"pdf"|"docx"|"pptx"|"plain"|null}
 */
function resolveHandlerKey(mimeType, filename) {
  const normalizedMime = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (normalizedMime && MIME_HANDLERS[normalizedMime]) {
    return MIME_HANDLERS[normalizedMime];
  }

  const ext = extensionOf(filename);
  for (const [key, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(ext)) return key;
  }
  return null;
}

/**
 * @param {string} filename
 * @returns {string | undefined}
 */
function titleFromFilename(filename) {
  if (!filename) return undefined;
  const base = filename.replace(/\\/g, "/").split("/").pop() || filename;
  const i = base.lastIndexOf(".");
  const stem = i > 0 ? base.slice(0, i) : base;
  return stem.trim() || undefined;
}

/**
 * @param {Buffer} buffer
 * @param {{ mimeType?: string; filename?: string }} meta
 * @returns {Promise<{ content: string; title?: string; pages?: number }>}
 */
export async function extractFromFile(buffer, meta = {}) {
  const mimeType = meta.mimeType || "";
  const filename = meta.filename || "";

  if (!buffer || buffer.length === 0) {
    const err = new Error("Uploaded file is empty");
    err.code = ERROR.FILE_PARSE_FAILED;
    throw err;
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    const err = new Error(
      `File exceeds ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(1)} MB limit`,
    );
    err.code = ERROR.FILE_TOO_LARGE;
    throw err;
  }

  const handlerKey = resolveHandlerKey(mimeType, filename);
  if (!handlerKey) {
    const err = new Error(
      `Unsupported file type (${mimeType || extensionOf(filename) || "unknown"})`,
    );
    err.code = ERROR.UNSUPPORTED_FILE_TYPE;
    throw err;
  }

  /** @type {{ content: string; pages?: number }} */
  let extracted;
  try {
    switch (handlerKey) {
      case "pdf":
        extracted = await extractPdfText(buffer);
        break;
      case "docx":
        extracted = await extractDocxText(buffer);
        break;
      case "pptx":
        extracted = extractPptxText(buffer);
        break;
      case "plain":
        extracted = extractPlainText(buffer, filename);
        break;
      default: {
        const err = new Error("Unsupported file handler");
        err.code = ERROR.UNSUPPORTED_FILE_TYPE;
        throw err;
      }
    }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err) throw err;
    const wrapped = new Error(
      err instanceof Error ? err.message : "File parsing failed",
    );
    wrapped.code = ERROR.FILE_PARSE_FAILED;
    throw wrapped;
  }

  return {
    content: extracted.content,
    title: titleFromFilename(filename),
    pages: extracted.pages,
  };
}
