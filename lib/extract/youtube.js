import { YoutubeTranscript } from "youtube-transcript";
import { ERROR } from "../constants.js";

/**
 * @param {string} url
 * @returns {string | null}
 */
export function parseYoutubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && id.length >= 6 ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = parsed.searchParams.get("v");
      if (v) return v;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }
  } catch {
    const bare = trimmed.match(/^[\w-]{11}$/);
    if (bare) return bare[0];
  }

  return null;
}

/**
 * @param {string} url
 * @returns {Promise<{ content: string; sourceUrl: string; videoSeconds?: number; title?: string }>}
 */
export async function extractYoutube(url) {
  const videoId = parseYoutubeVideoId(url);
  if (!videoId) {
    const err = new Error("Invalid YouTube URL");
    err.code = ERROR.VALIDATION_ERROR;
    throw err;
  }

  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;

  let segments;
  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId);
  } catch (err) {
    const wrapped = new Error(
      err instanceof Error ? err.message : "Could not fetch YouTube transcript",
    );
    wrapped.code = ERROR.NO_TRANSCRIPT;
    throw wrapped;
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    const err = new Error("No transcript available for this video");
    err.code = ERROR.NO_TRANSCRIPT;
    throw err;
  }

  const content = segments
    .map((s) => s.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!content) {
    const err = new Error("Transcript is empty");
    err.code = ERROR.NO_TRANSCRIPT;
    throw err;
  }

  const last = segments[segments.length - 1];
  const endSeconds =
    (typeof last.offset === "number" ? last.offset : 0) +
    (typeof last.duration === "number" ? last.duration : 0);
  const videoSeconds =
    endSeconds > 0 ? Math.ceil(endSeconds) : undefined;

  return {
    content,
    sourceUrl,
    videoSeconds,
    title: `YouTube video ${videoId}`,
  };
}
