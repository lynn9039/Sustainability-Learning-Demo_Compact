import { INPUT_TYPES, ERROR } from "../constants.js";
import { extractFromFile } from "./file.js";
import { extractLink } from "./link.js";
import { extractText } from "./text.js";
import { extractYoutube } from "./youtube.js";

/**
 * @typedef {Object} ExtractResult
 * @property {string} content
 * @property {string} [sourceUrl]
 * @property {string} [title]
 * @property {string} [author]
 * @property {string} [publisher]
 * @property {string} [publishedDate]
 * @property {string} [heroImageUrl]
 * @property {number} [pages]
 * @property {number} [videoSeconds]
 */

/**
 * @param {Object} params
 * @param {string} params.inputType
 * @param {string} [params.url]
 * @param {string} [params.text]
 * @param {Buffer} [params.fileBuffer]
 * @param {string} [params.mimeType]
 * @param {string} [params.filename]
 * @returns {Promise<ExtractResult>}
 */
export async function extractByInputType(params) {
  const inputType = params.inputType;

  if (!INPUT_TYPES.includes(inputType)) {
    const err = new Error(`Invalid inputType: ${inputType}`);
    err.code = ERROR.VALIDATION_ERROR;
    throw err;
  }

  switch (inputType) {
    case "link": {
      if (!params.url?.trim()) {
        const err = new Error("URL is required for link input");
        err.code = ERROR.VALIDATION_ERROR;
        throw err;
      }
      return extractLink(params.url.trim());
    }

    case "text": {
      return extractText(params.text || "");
    }

    case "youtube": {
      if (!params.url?.trim()) {
        const err = new Error("YouTube URL is required");
        err.code = ERROR.VALIDATION_ERROR;
        throw err;
      }
      return extractYoutube(params.url.trim());
    }

    case "file": {
      if (!params.fileBuffer?.length) {
        const err = new Error("File upload is required");
        err.code = ERROR.VALIDATION_ERROR;
        throw err;
      }
      return extractFromFile(params.fileBuffer, {
        mimeType: params.mimeType,
        filename: params.filename,
      });
    }

    default: {
      const err = new Error(`Unsupported inputType: ${inputType}`);
      err.code = ERROR.VALIDATION_ERROR;
      throw err;
    }
  }
}
