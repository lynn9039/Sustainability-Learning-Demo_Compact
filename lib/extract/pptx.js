import { unzipSync } from "fflate";

const SLIDE_PATH_RE = /^ppt\/slides\/slide(\d+)\.xml$/i;
const TEXT_NODE_RE = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;

/**
 * @param {string} raw
 */
function decodeXmlEntities(raw) {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * @param {string} xml
 * @returns {string}
 */
function extractSlideText(xml) {
  const chunks = [];
  for (const match of xml.matchAll(TEXT_NODE_RE)) {
    const piece = decodeXmlEntities(match[1]).trim();
    if (piece) chunks.push(piece);
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Extract slide text from PPTX (OOXML zip) via fflate + simple a:t parsing.
 *
 * @param {Buffer} buffer
 * @returns {{ content: string; pages: number }}
 */
export function extractPptxText(buffer) {
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`PPTX could not be unzipped: ${message}`);
  }

  const slideEntries = Object.keys(files)
    .map((path) => {
      const match = path.match(SLIDE_PATH_RE);
      if (!match) return null;
      return { path, index: Number.parseInt(match[1], 10) };
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

  if (slideEntries.length === 0) {
    throw new Error("No slides found in PPTX");
  }

  const parts = [];
  for (const { path } of slideEntries) {
    const xml = new TextDecoder("utf-8").decode(files[path]);
    const slideText = extractSlideText(xml);
    if (slideText) parts.push(slideText);
  }

  const content = parts.join("\n\n").trim();
  if (!content) {
    throw new Error(
      "No extractable text in PPTX slides — try pasting the content directly",
    );
  }

  return { content, pages: slideEntries.length };
}
