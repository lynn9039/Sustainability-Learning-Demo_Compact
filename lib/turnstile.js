const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Spin managed Worker — secret stays on Worker, not Vercel. */
const SITEVERIFY_WORKER_URL =
  process.env.TURNSTILE_SITEVERIFY_URL ||
  "https://turnstile-siteverify-sustainability-learning-demo.ly05212x.workers.dev";

/**
 * @param {string} token
 * @param {string} [remoteip]
 * @returns {Promise<{ ok: true } | { ok: false; reason: string }>}
 */
export async function verifyTurnstile(token, remoteip) {
  if (!token || typeof token !== "string" || !token.trim()) {
    return { ok: false, reason: "missing token" };
  }

  const trimmed = token.trim();

  if (SITEVERIFY_WORKER_URL) {
    try {
      const res = await fetch(SITEVERIFY_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: trimmed,
          ...(remoteip ? { remoteip } : {}),
        }),
      });

      if (!res.ok) {
        return { ok: false, reason: `siteverify worker HTTP ${res.status}` };
      }

      /** @type {{ success?: boolean; "error-codes"?: string[] }} */
      const data = await res.json();
      if (data.success) return { ok: true };

      const codes = data["error-codes"]?.join(", ") || "verification failed";
      return { ok: false, reason: codes };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: message };
    }
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, reason: "TURNSTILE_SECRET_KEY is not configured" };
  }

  const body = new URLSearchParams({
    secret,
    response: trimmed,
  });
  if (remoteip) body.set("remoteip", remoteip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      return { ok: false, reason: `siteverify HTTP ${res.status}` };
    }

    /** @type {{ success?: boolean; "error-codes"?: string[] }} */
    const data = await res.json();
    if (data.success) return { ok: true };

    const codes = data["error-codes"]?.join(", ") || "verification failed";
    return { ok: false, reason: codes };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: message };
  }
}
