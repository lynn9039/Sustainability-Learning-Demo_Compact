import mammoth from "mammoth";

/**
 * Extract plain text from a DOCX buffer.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ content: string }>}
 */
export async function extractDocxText(buffer) {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`DOCX could not be parsed: ${message}`);
  }

  const content = (result.value || "").replace(/\r\n/g, "\n").trim();
  if (!content) {
    throw new Error(
      "No extractable text in DOCX — try pasting the content directly",
    );
  }

  return { content };
}
