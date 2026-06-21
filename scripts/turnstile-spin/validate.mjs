#!/usr/bin/env node
/**
 * Validate deployed Spin siteverify Worker.
 * Usage: CLOUDFLARE_API_TOKEN=... node scripts/turnstile-spin/validate.mjs --worker-url <url> [--account-id <id>]
 */
import { spawnSync } from "node:child_process";

const SITEKEY = "0x4AAAAAADQq4jkp-mrqyCJd";
const EXPECTED_DOMAINS = ["localhost", "127.0.0.1"];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const workerUrl = arg("--worker-url");
  const accountId = arg("--account-id");

  if (!workerUrl) {
    console.error(JSON.stringify({ status: "error", detail: "--worker-url required" }));
    process.exit(1);
  }

  const health = await fetch(`${workerUrl.replace(/\/$/, "")}/health`);
  const healthJson = await health.json();
  if (!healthJson?.ok) {
    console.error(JSON.stringify({ status: "error", check: "health", detail: "worker /health failed" }));
    process.exit(1);
  }

  const dummy = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "XXXX.DUMMY.TOKEN.XXXX" }),
  });
  const dummyJson = await dummy.json();
  if (dummyJson.success !== false || !Array.isArray(dummyJson["error-codes"]) || dummyJson["error-codes"].length === 0) {
    console.error(JSON.stringify({ status: "error", check: "dummy_siteverify", detail: "unexpected dummy response" }));
    process.exit(1);
  }
  if (!dummyJson._worker?.worker_version) {
    console.error(JSON.stringify({ status: "error", check: "worker_metadata", detail: "_worker metadata missing" }));
    process.exit(1);
  }

  if (process.env.CLOUDFLARE_API_TOKEN && accountId) {
    const widgetRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/challenges/widgets/${SITEKEY}`,
      { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } },
    );
    const widget = await widgetRes.json();
    const registered = widget?.result?.domains ?? [];
    const missing = EXPECTED_DOMAINS.filter((d) => !registered.includes(d));
    if (missing.length) {
      console.error(JSON.stringify({ status: "error", check: "hostname", detail: `missing domains: ${missing.join(" ")}` }));
      process.exit(1);
    }
  }

  console.log(JSON.stringify({ status: "ok" }));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: err.message }));
  process.exit(1);
});
