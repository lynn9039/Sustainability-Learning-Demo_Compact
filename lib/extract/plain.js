/**
 * Read plain text or Markdown upload as UTF-8 content.
 *
 * @param {Buffer} buffer
 * @param {string} [filename]
 * @returns {{ content: string }}
 */
export function extractPlainText(buffer, filename = "") {
  let content = buffer.toString("utf8");

  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  content = content.replace(/\r\n/g, "\n").trim();
  if (!content) {
    const label = filename || "text file";
    throw new Error(`No readable text in ${label}`);
  }

  return { content };
}
