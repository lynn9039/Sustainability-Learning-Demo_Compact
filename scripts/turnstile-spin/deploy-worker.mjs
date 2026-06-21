#!/usr/bin/env node
/**
 * Deploy Spin managed siteverify Worker (Windows-friendly).
 * Usage: CLOUDFLARE_API_TOKEN=... node scripts/turnstile-spin/deploy-worker.mjs
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");
const DEPLOY_DIR = join(ROOT, ".turnstile-spin-deploy");
const WORKER_NAME = "turnstile-siteverify-sustainability-learning-demo";
const SITEKEY = "0x4AAAAAADQq4jkp-mrqyCJd";

function loadSecret() {
  if (process.env.WIDGET_SECRET) return process.env.WIDGET_SECRET.trim();
  for (const f of [".env.local", ".env"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^TURNSTILE_SECRET_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error("WIDGET_SECRET / TURNSTILE_SECRET_KEY not found");
}

function run(cmd, opts = {}) {
  return spawnSync(cmd, { shell: true, stdio: "pipe", encoding: "utf8", ...opts });
}

async function main() {
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.error(JSON.stringify({ status: "missing_token", reason: "CLOUDFLARE_API_TOKEN not set" }));
    process.exit(1);
  }

  const secret = loadSecret();
  process.env.WIDGET_SECRET = secret;

  const whoami = run("npx wrangler whoami --json");
  if (whoami.status !== 0 || !whoami.stdout.trim().startsWith("{")) {
    console.error(JSON.stringify({ status: "auth_failed", detail: whoami.stderr || whoami.stdout }));
    process.exit(1);
  }

  let deploy = run(`npx wrangler deploy --name ${WORKER_NAME}`, { cwd: DEPLOY_DIR });
  let workerName = WORKER_NAME;
  if (deploy.status !== 0 && (deploy.stderr + deploy.stdout).includes("already in use")) {
    workerName = `${WORKER_NAME}-${Date.now().toString(36).slice(-5)}`;
    deploy = run(`npx wrangler deploy --name ${workerName}`, { cwd: DEPLOY_DIR });
  }
  if (deploy.status !== 0) {
    console.error(JSON.stringify({ status: "deploy_failed", detail: deploy.stderr || deploy.stdout }));
    process.exit(1);
  }

  const combined = deploy.stdout + deploy.stderr;
  let workerUrl =
    combined.match(/https:\/\/[a-zA-Z0-9._-]+\.workers\.dev/)?.[0] ?? null;

  const setSecret = spawnSync(
    "npx",
    ["wrangler", "secret", "put", "TURNSTILE_SECRET_KEY", "--name", workerName],
    {
      cwd: DEPLOY_DIR,
      input: secret + "\n",
      encoding: "utf8",
      shell: true,
      env: { ...process.env },
    },
  );
  if (setSecret.status !== 0) {
    console.error(
      JSON.stringify({
        status: "set_secret_failed",
        worker_name: workerName,
        detail: setSecret.stderr || setSecret.stdout,
      }),
    );
    process.exit(1);
  }

  await new Promise((r) => setTimeout(r, 5000));

  if (!workerUrl) {
    console.error(JSON.stringify({ status: "url_parse_failed", worker_name: workerName }));
    process.exit(1);
  }

  const indexPath = join(ROOT, "public", "index.html");
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, "utf8");
    const updated = html.replace(
      /window\.TURNSTILE_SITEVERIFY_URL\s*=\s*"[^"]*";/,
      `window.TURNSTILE_SITEVERIFY_URL = "${workerUrl}";`,
    );
    writeFileSync(indexPath, updated, "utf8");
  }

  console.log(
    JSON.stringify({
      status: "ok",
      worker_url: workerUrl,
      worker_name: workerName,
      sitekey: SITEKEY,
    }),
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: err.message }));
  process.exit(1);
});
