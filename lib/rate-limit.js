import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RATE_LIMIT_PER_DAY } from "./constants.js";

/** @type {Ratelimit | null} */
let ratelimit = null;

/**
 * @returns {Ratelimit | null}
 */
function getRatelimit() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  if (!ratelimit) {
    const redis = new Redis({ url, token });
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_PER_DAY, "1 d"),
      prefix: "sld:generate",
    });
  }
  return ratelimit;
}

/**
 * Count one generation attempt for this IP (call after Turnstile passes, before LLM).
 * Upstash `limit()` checks the quota and increments in one step.
 *
 * @param {string} ip
 * @returns {Promise<{ allowed: boolean; skipped: boolean; remaining?: number; limit?: number }>}
 */
export async function consumeRateLimitAttempt(ip) {
  if (process.env.VERCEL_ENV !== "production") {
    return { allowed: true, skipped: true };
  }

  const rl = getRatelimit();
  const identifier = (ip && ip.trim()) || "unknown";

  if (!rl) {
    console.warn(
      "[rate-limit] KV_REST_API_URL / KV_REST_API_TOKEN not set — skipping rate limit (Turnstile only).",
    );
    return { allowed: true, skipped: true };
  }

  const { success, remaining, limit } = await rl.limit(identifier);
  return {
    allowed: success,
    skipped: false,
    remaining,
    limit,
  };
}

/**
 * Best-effort client IP for rate limit + Turnstile remoteip.
 * @param {import("http").IncomingMessage} req
 * @returns {string}
 */
export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(",")[0].trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.length > 0) return realIp.trim();
  return req.socket?.remoteAddress || "unknown";
}
