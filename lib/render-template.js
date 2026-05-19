import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const LABELS = {
  en: {
    tab1: "Summary",
    tab2: "Interpretation",
    tab3: "Insights",
    tocTitle: "On this page",
    tablistAria: "Learning page sections",
    generated: "Generated",
    source: "Source",
  },
  zh: {
    tab1: "摘要",
    tab2: "解读",
    tab3: "洞察",
    tocTitle: "本页目录",
    tablistAria: "学习页面章节",
    generated: "生成时间",
    source: "来源",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sourceType(inputType, language) {
  const zh = language === "zh";
  if (inputType === "text") return zh ? "粘贴文本" : "Pasted text";
  if (inputType === "file") return zh ? "上传文档" : "Uploaded document";
  if (inputType === "youtube") return zh ? "YouTube 视频" : "YouTube video";
  return zh ? "网页文章" : "Web article";
}

function sourceUrlLabel(sourceUrl, language) {
  if (!sourceUrl) return language === "zh" ? "来源" : "Source";
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return language === "zh" ? "来源" : "Source";
  }
}

function fallbackSourceMeta(payload, language) {
  const parts = [
    payload.author,
    payload.publisher,
    payload.publishedDate,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  return language === "zh" ? "用户提供的资料" : "User-provided source";
}

function heroImageBlock(url) {
  if (!url) return "";
  return `<div class="hero-image"><img src="${escapeHtml(url)}" alt="" loading="lazy" /></div>`;
}

function replaceAll(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(`{{${key}}}`).join(value ?? "");
  }
  return html;
}

/**
 * @param {import("./constants.js").ExtractedPayload} payload
 * @param {{ pageTitle: string; sourceMeta: string; tab1Html: string; tab2Html: string; tab3Html: string }} parts
 * @returns {string}
 */
export function renderLearningPage(payload, parts) {
  const template = readFileSync(join(ROOT, "assets", "template.html"), "utf8")
    .replace(/^<!--[\s\S]*?-->\s*/, "");
  const language = payload.language === "zh" ? "zh" : "en";
  const labels = LABELS[language];
  const sourceUrl = payload.sourceUrl || "#";
  const title = parts.pageTitle || payload.title || "Sustainability Learning Page";

  return replaceAll(template, {
    LANG: language,
    PAGE_TITLE: escapeHtml(title),
    SOURCE_TYPE: escapeHtml(sourceType(payload.inputType, language)),
    SOURCE_META: escapeHtml(parts.sourceMeta || fallbackSourceMeta(payload, language)),
    SOURCE_URL: escapeHtml(sourceUrl),
    SOURCE_URL_LABEL: escapeHtml(sourceUrlLabel(sourceUrl, language)),
    HERO_IMAGE_BLOCK: heroImageBlock(payload.heroImageUrl),
    LABEL_TOC_TITLE: escapeHtml(labels.tocTitle),
    LABEL_TABLIST_ARIA: escapeHtml(labels.tablistAria),
    LABEL_TAB1: escapeHtml(labels.tab1),
    LABEL_TAB2: escapeHtml(labels.tab2),
    LABEL_TAB3: escapeHtml(labels.tab3),
    LABEL_GENERATED: escapeHtml(labels.generated),
    LABEL_SOURCE: escapeHtml(labels.source),
    TAB1_HTML: parts.tab1Html,
    TAB2_HTML: parts.tab2Html,
    TAB3_HTML: parts.tab3Html,
    GENERATED_ON: escapeHtml(payload.generatedOn || new Date().toISOString().slice(0, 10)),
  });
}
