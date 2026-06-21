/** @type {string} */
let turnstileToken = "";

/** @type {string | null} */
let lastGeneratedHtml = null;

const form = document.getElementById("demo-form");
const inputTypeField = document.getElementById("input-type");
const tabs = document.querySelectorAll(".tablist .tab");
const panels = document.querySelectorAll(".panel");
const submitBtn = document.getElementById("submit-btn");
const loadingEl = document.getElementById("loading");
const skeletonEl = document.getElementById("skeleton");
const bannerEl = document.getElementById("error-banner");
const errorTitleEl = document.getElementById("error-title");
const errorMessageEl = document.getElementById("error-message");
const errorCodeEl = document.getElementById("error-code");
const resultEl = document.getElementById("result");
const previewEl = document.getElementById("preview");
const downloadBtn = document.getElementById("download-btn");

const urlLink = document.getElementById("url-link");
const textContent = document.getElementById("text-content");
const textCount = document.getElementById("text-count");
const fileUpload = document.getElementById("file-upload");
const focusCategories = document.getElementById("focus-categories");
const focusDimensions = document.getElementById("focus-dimensions");

/** @type {string} */
let activeInputType = "link";

/** @type {Record<string, { title: string; fallback: string }>} */
const ERROR_COPY = {
  METHOD_NOT_ALLOWED: {
    title: "Invalid request",
    fallback: "Please refresh the page and try again.",
  },
  MISSING_TURNSTILE: {
    title: "Verification required",
    fallback: "Complete the captcha before submitting.",
  },
  TURNSTILE_FAILED: {
    title: "Verification failed",
    fallback: "Please refresh the captcha and try again.",
  },
  RATE_LIMIT: {
    title: "Daily limit reached",
    fallback: "You have used all 3 generations for today. Please try again tomorrow.",
  },
  VALIDATION_ERROR: {
    title: "Text too short",
    fallback: "The text is too short to analyze. Please paste more content and try again.",
  },
  CONTENT_TOO_LONG: {
    title: "Content too long",
    fallback:
      "The public compact demo works best with focused excerpts under about 2,200 characters.",
  },
  FILE_TOO_LARGE: {
    title: "File too large",
    fallback: "Maximum upload size is 4.5 MB.",
  },
  UNSUPPORTED_FILE_TYPE: {
    title: "Unsupported file",
    fallback: "Use PDF, DOCX, PPTX, TXT, or MD.",
  },
  FETCH_FAILED: {
    title: "Could not read this link",
    fallback: "Try pasting the article text under “Paste text”.",
  },
  LOGIN_WALL: {
    title: "LinkedIn not accessible",
    fallback: "Copy the post and paste it under “Paste text”.",
  },
  NO_TRANSCRIPT: {
    title: "YouTube disabled",
    fallback: "Please paste a short transcript excerpt instead.",
  },
  FILE_PARSE_FAILED: {
    title: "Could not read file",
    fallback: "Try another format or paste the content directly.",
  },
  CONFIDENTIAL: {
    title: "Confidential content",
    fallback:
      "This document appears to be marked confidential. We cannot generate a public learning page from it.",
  },
  GENERATION_FAILED: {
    title: "Generation failed",
    fallback: "The AI did not return a valid page. Please try again.",
  },
  GENERATION_TIMEOUT: {
    title: "Generation took too long",
    fallback:
      "Claude needed too much time for this content. Try a shorter, more focused excerpt.",
  },
};

/**
 * Read token from Turnstile callback state or the hidden response field.
 * @returns {string}
 */
function getTurnstileToken() {
  const fromCallback = (window.__turnstileToken || turnstileToken || "").trim();
  if (fromCallback) return fromCallback;

  const responseField = form.querySelector(
    'textarea[name="cf-turnstile-response"], input[name="cf-turnstile-response"]',
  );
  return (responseField?.value || "").trim();
}

function syncSubmitForTurnstile() {
  submitBtn.disabled = !getTurnstileToken();
}

window.addEventListener("turnstile:ready", () => {
  turnstileToken = window.__turnstileToken || "";
  syncSubmitForTurnstile();
});
window.addEventListener("turnstile:expired", () => {
  turnstileToken = "";
  syncSubmitForTurnstile();
});
window.addEventListener("turnstile:error", () => {
  turnstileToken = "";
  syncSubmitForTurnstile();
});

/**
 * @param {string} inputType
 */
function activateInputTab(inputType) {
  activeInputType = inputType;
  inputTypeField.value = inputType;

  tabs.forEach((tab) => {
    const selected = tab.dataset.inputType === inputType;
    tab.setAttribute("aria-selected", selected ? "true" : "false");
  });

  panels.forEach((panel) => {
    const id = `panel-${inputType}`;
    panel.setAttribute("data-active", panel.id === id ? "true" : "false");
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const type = tab.dataset.inputType;
    if (type) activateInputTab(type);
  });
});

function updateTextCount() {
  if (!textCount || !textContent) return;
  textCount.textContent = String(textContent.value.length);
}

textContent.addEventListener("input", updateTextCount);

/**
 * @returns {{ categories?: string[]; impactDimensions?: string[] } | null}
 */
function buildFocusAreas() {
  const categories = (focusCategories.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const impactDimensions = (focusDimensions.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (categories.length === 0 && impactDimensions.length === 0) return null;

  /** @type {{ categories?: string[]; impactDimensions?: string[] }} */
  const focus = {};
  if (categories.length > 0) focus.categories = categories;
  if (impactDimensions.length > 0) focus.impactDimensions = impactDimensions;
  return focus;
}

function hideBanner() {
  bannerEl.dataset.visible = "false";
  errorMessageEl.textContent = "";
  errorCodeEl.textContent = "";
}

/**
 * @param {string} code
 * @param {string} [hint]
 */
function showBanner(code, hint) {
  const copy = ERROR_COPY[code] || {
    title: "Something went wrong",
    fallback: "Please try again.",
  };
  errorTitleEl.textContent = copy.title;
  errorMessageEl.textContent = hint || copy.fallback;
  errorCodeEl.textContent = code ? `Code: ${code}` : "";
  bannerEl.dataset.visible = "true";
  bannerEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

/**
 * @param {boolean} busy
 */
function setBusy(busy) {
  submitBtn.disabled = busy || !getTurnstileToken();
  loadingEl.dataset.visible = busy ? "true" : "false";
  skeletonEl.dataset.visible = busy ? "true" : "false";
}

function resetTurnstile() {
  turnstileToken = "";
  window.__turnstileToken = "";
  if (typeof window.turnstile !== "undefined" && window.turnstile.reset) {
    try {
      window.turnstile.reset();
    } catch {
      /* widget may not be ready */
    }
  }
  syncSubmitForTurnstile();
}

/**
 * @returns {string | null} client-side error code, or null if ok
 */
function validateClient() {
  if (!getTurnstileToken()) return "MISSING_TURNSTILE";

  switch (activeInputType) {
    case "link":
      if (!urlLink.value.trim()) return "VALIDATION_ERROR";
      break;
    case "text":
      if (!textContent.value.trim()) return "VALIDATION_ERROR";
      break;
    case "file":
      if (!fileUpload.files?.length) return "VALIDATION_ERROR";
      break;
    default:
      return "VALIDATION_ERROR";
  }
  return null;
}

/**
 * @returns {FormData}
 */
function buildFormData() {
  const fd = new FormData();
  fd.append("inputType", activeInputType);
  fd.append("turnstileToken", getTurnstileToken());

  if (activeInputType === "link") {
    fd.append("url", urlLink.value.trim());
  } else if (activeInputType === "text") {
    fd.append("text", textContent.value);
  } else if (activeInputType === "file" && fileUpload.files?.[0]) {
    fd.append("file", fileUpload.files[0]);
  }

  const focus = buildFocusAreas();
  if (focus) fd.append("focusAreas", JSON.stringify(focus));

  return fd;
}

/**
 * @param {string} html
 */
function showResult(html) {
  lastGeneratedHtml = html;
  previewEl.srcdoc = html;
  resultEl.dataset.visible = "true";
  downloadBtn.disabled = false;
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

downloadBtn.addEventListener("click", () => {
  if (!lastGeneratedHtml) return;
  const blob = new Blob([lastGeneratedHtml], {
    type: "text/html;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sustainability-learning-page.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideBanner();

  const clientError = validateClient();
  if (clientError) {
    const hint =
      clientError === "VALIDATION_ERROR"
        ? "Please fill in the required field for the selected tab, or paste more text."
        : undefined;
    showBanner(clientError, hint);
    return;
  }

  setBusy(true);
  resultEl.dataset.visible = "false";
  downloadBtn.disabled = true;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      body: buildFormData(),
    });

    /** @type {{ html?: string; error?: string; hint?: string }} */
    let data;
    try {
      data = await response.json();
    } catch {
      showBanner("GENERATION_FAILED", "Server returned an invalid response.");
      return;
    }

    if (data.html) {
      showResult(data.html);
      return;
    }

    if (data.error) {
      showBanner(data.error, data.hint);
      return;
    }

    showBanner("GENERATION_FAILED", "Unexpected response from server.");
  } catch {
    showBanner(
      "GENERATION_FAILED",
      "Network error — check your connection and try again.",
    );
  } finally {
    setBusy(false);
    resetTurnstile();
  }
});

activateInputTab("link");
updateTextCount();
syncSubmitForTurnstile();
