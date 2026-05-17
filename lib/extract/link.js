import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { ERROR, FETCH_MAX_BYTES, FETCH_TIMEOUT_MS } from "../constants.js";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SustainabilityLearningBot/1.0; +https://vercel.com)";

/**
 * @param {string} url
 */
function isLinkedInHost(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "linkedin.com" || host.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

/**
 * @param {ReadableStream<Uint8Array>} body
 * @param {number} maxBytes
 */
async function readBodyWithLimit(body, maxBytes) {
  const reader = body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      const err = new Error("Response body too large");
      err.code = ERROR.FETCH_FAILED;
      throw err;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/**
 * @param {string} url
 */
async function fetchHtml(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,zh-CN,zh;q=0.8",
      },
    });

    if (!res.ok) {
      const err = new Error(`URL returned HTTP ${res.status}`);
      err.code = ERROR.FETCH_FAILED;
      err.httpStatus = res.status;
      throw err;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      const err = new Error(`URL is not an HTML page (${contentType || "unknown type"})`);
      err.code = ERROR.FETCH_FAILED;
      throw err;
    }

    if (!res.body) {
      const err = new Error("Empty response body");
      err.code = ERROR.FETCH_FAILED;
      throw err;
    }

    const bytes = await readBodyWithLimit(res.body, FETCH_MAX_BYTES);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { html, finalUrl: res.url || url };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutErr = new Error("Fetching the URL timed out");
      timeoutErr.code = ERROR.FETCH_FAILED;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * @param {string} pageUrl
 * @param {import('cheerio').CheerioAPI} $
 */
function readOpenGraph(pageUrl, $) {
  const ogTitle =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content");
  const ogImage =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content");
  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content");

  /** @type {string | undefined} */
  let heroImageUrl;
  if (ogImage) {
    try {
      heroImageUrl = new URL(ogImage, pageUrl).href;
    } catch {
      heroImageUrl = ogImage;
    }
  }

  return {
    title: ogTitle?.trim(),
    author: author?.trim(),
    heroImageUrl,
  };
}

/**
 * @param {string} url
 * @returns {Promise<{ content: string; sourceUrl: string; title?: string; author?: string; heroImageUrl?: string }>}
 */
export async function extractLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    const err = new Error("Invalid URL");
    err.code = ERROR.VALIDATION_ERROR;
    throw err;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    const err = new Error("Only http(s) URLs are supported");
    err.code = ERROR.VALIDATION_ERROR;
    throw err;
  }

  const linkedIn = isLinkedInHost(url);
  let html;
  let finalUrl;

  try {
    ({ html, finalUrl } = await fetchHtml(url));
  } catch (err) {
    if (linkedIn) {
      const wall = new Error(
        "LinkedIn blocks automated fetching — please paste the post text instead",
      );
      wall.code = ERROR.LOGIN_WALL;
      throw wall;
    }
    throw err;
  }

  const $ = cheerio.load(html);
  const meta = readOpenGraph(finalUrl, $);

  const dom = new JSDOM(html, { url: finalUrl });
  const document = dom.window.document;
  const article = new Readability(document).parse();

  const content = (article?.textContent || "").replace(/\s+/g, " ").trim();
  if (!content) {
    const err = new Error(
      linkedIn
        ? "Could not extract LinkedIn post text — please paste the content instead"
        : "Could not extract article text from this page — try pasting the content instead",
    );
    err.code = linkedIn ? ERROR.LOGIN_WALL : ERROR.FETCH_FAILED;
    throw err;
  }

  return {
    content,
    sourceUrl: finalUrl,
    title: article?.title?.trim() || meta.title,
    author: meta.author,
    heroImageUrl: meta.heroImageUrl,
  };
}
