import Busboy from "busboy";
import { ERROR, MAX_UPLOAD_BYTES } from "./constants.js";

/**
 * @typedef {Object} ParsedMultipart
 * @property {string} inputType
 * @property {string} turnstileToken
 * @property {string} [url]
 * @property {string} [text]
 * @property {import("./constants.js").FocusAreas} [focusAreas]
 * @property {Buffer} [fileBuffer]
 * @property {string} [mimeType]
 * @property {string} [filename]
 */

/**
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<ParsedMultipart>}
 */
export function parseMultipartRequest(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    /** @type {Record<string, string>} */
    const fields = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === "string") fields[key] = value;
    }
    return Promise.resolve(normalizeMultipartFields(fields, undefined, "", ""));
  }

  return new Promise((resolve, reject) => {
    /** @type {Record<string, string>} */
    const fields = {};
    /** @type {Promise<void>[]} */
    const fileTasks = [];
    /** @type {Buffer | undefined} */
    let fileBuffer;
    let mimeType = "";
    let filename = "";

    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 20 },
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (_fieldname, file, info) => {
      const task = new Promise((res, rej) => {
        /** @type {Buffer[]} */
        const chunks = [];

        file.on("data", (chunk) => chunks.push(chunk));
        file.on("limit", () => {
          const err = new Error(
            `File exceeds ${(MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(1)} MB limit`,
          );
          err.code = ERROR.FILE_TOO_LARGE;
          rej(err);
        });
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
          mimeType = info.mimeType || "";
          filename = info.filename || "";
          res();
        });
        file.on("error", rej);
      });
      fileTasks.push(task);
    });

    busboy.on("error", reject);

    busboy.on("finish", () => {
      Promise.all(fileTasks)
        .then(() => {
          try {
            resolve(normalizeMultipartFields(fields, fileBuffer, mimeType, filename));
          } catch (err) {
            reject(err);
          }
        })
        .catch(reject);
    });

    if (req.body) {
      const body =
        Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body));
      busboy.end(body);
    } else {
      /** @type {Buffer[]} */
      const rawChunks = [];
      req.on("data", (chunk) => rawChunks.push(Buffer.from(chunk)));
      req.on("end", () => busboy.end(Buffer.concat(rawChunks)));
      req.on("error", reject);
    }
  });
}

/**
 * @param {Record<string, string>} fields
 * @param {Buffer | undefined} fileBuffer
 * @param {string} mimeType
 * @param {string} filename
 * @returns {ParsedMultipart}
 */
function normalizeMultipartFields(fields, fileBuffer, mimeType, filename) {
  const inputType = (fields.inputType || "").trim();
  const turnstileToken = (fields.turnstileToken || "").trim();
  const url = (fields.url || fields.sourceUrl || "").trim() || undefined;
  const text = fields.text !== undefined ? fields.text : undefined;

  if (!inputType) {
    const err = new Error("inputType is required");
    err.code = ERROR.VALIDATION_ERROR;
    throw err;
  }

  if (!turnstileToken) {
    const err = new Error("turnstileToken is required");
    err.code = ERROR.MISSING_TURNSTILE;
    throw err;
  }

  /** @type {import("./constants.js").FocusAreas | undefined} */
  let focusAreas;
  if (fields.focusAreas && fields.focusAreas.trim()) {
    try {
      const parsed = JSON.parse(fields.focusAreas);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        focusAreas = parsed;
      } else {
        const err = new Error("focusAreas must be a JSON object");
        err.code = ERROR.VALIDATION_ERROR;
        throw err;
      }
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) throw err;
      const parseErr = new Error("focusAreas is not valid JSON");
      parseErr.code = ERROR.VALIDATION_ERROR;
      throw parseErr;
    }
  }

  return {
    inputType,
    turnstileToken,
    url,
    text,
    focusAreas,
    fileBuffer,
    mimeType: mimeType || undefined,
    filename: filename || undefined,
  };
}
