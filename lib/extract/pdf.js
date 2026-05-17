import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * Extract text from a PDF buffer using pdfjs-dist (no worker — serverless-safe).
 *
 * @param {Buffer} buffer
 * @returns {Promise<{ content: string; pages: number }>}
 */
export async function extractPdfText(buffer) {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    useWorkerFetch: false,
  });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`PDF could not be opened: ${message}`);
  }

  const pageCount = pdf.numPages;
  const parts = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) parts.push(pageText);
  }

  try {
    await pdf.destroy();
  } catch {
    /* optional cleanup */
  }

  const content = parts.join("\n\n").trim();
  if (!content) {
    throw new Error(
      "No extractable text in PDF (it may be scanned images only — try pasting the text instead)",
    );
  }

  return { content, pages: pageCount };
}
