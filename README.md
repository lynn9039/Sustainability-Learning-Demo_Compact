# Sustainability Learning Page — Vercel Demo (compact)

Turn a link, pasted text, or document (PDF/DOCX/PPTX/TXT/MD) into a **self-contained HTML learning page** (Summary · Interpretation · Insights) via Claude, styled with a sustainability analyst lens. This repo defaults to **compact** mode for Vercel Hobby (shorter prompts, server-side template fill, ~9k `max_tokens`).

## Stack

- **Frontend:** `public/index.html`, `app.js`, `styles.css` (sage UI, iframe preview)
- **API:** `api/generate.js` (Node serverless, 60s, multipart)
- **LLM:** Anthropic Messages API — `claude-sonnet-4-5-20250929` by default (`COMPACT_MAX_TOKENS` 9000 in compact mode; full mode uses 16000)
- **Mode:** `GENERATION_MODE=compact` by default; set `GENERATION_MODE=full` for self-hosted fuller outputs (full HTML from Claude, YouTube, longer inputs)
- **Prompt assets:** `assets/skill-prompt.md`, `assets/template.html` (bundled via `vercel.json` → `includeFiles`)
- **Abuse:** Cloudflare Turnstile + Vercel KV (3 attempts / IP / sliding 24h in production only)

## Bring your own keys (required)

This repository ships **without** any private credentials. Before running or deploying, supply your own:

| What | Where | Notes |
|------|--------|--------|
| Anthropic API key | Vercel env + local `.env` / `.env.local` | `ANTHROPIC_API_KEY` — **never commit** |
| Turnstile **secret** | Vercel env + local `.env` / `.env.local` | `TURNSTILE_SECRET_KEY` — **never commit** |
| Turnstile **site** key (public) | `public/index.html` → `data-sitekey="…"` | Not a secret, but must match **your** widget |
| Vercel KV REST | Vercel project (linked KV store) | `KV_REST_API_URL` + `KV_REST_API_TOKEN` injected automatically on Vercel |

**Local setup:** copy `.env.example` → `.env` or `.env.local`, fill in the secret values, and replace the Turnstile site key in `public/index.html` with the site key from [Cloudflare Turnstile](https://dash.cloudflare.com/) (add `localhost` and your Vercel domain to the widget’s allowed hostnames).

**Forking or cloning:** do not use the maintainer’s Turnstile widget or API keys. Create your own Anthropic key, Turnstile widget (site + secret pair), and KV store, then update `index.html` and Vercel environment variables.

**Never commit:** `.env`, `.env.local`, `.vercel/`, or any file containing `sk-ant-…` or live KV tokens. Only `.env.example` (empty placeholders) is tracked.

If a secret was ever pasted into git by mistake, **rotate it** in the provider console before pushing again.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel` or use `npx vercel`)
- [Anthropic API key](https://console.anthropic.com/)
- [Cloudflare Turnstile](https://dash.cloudflare.com/) widget (allow **localhost** in widget settings)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (recommended for production rate limits)

## Environment variables

Copy `.env.example` to `.env` or `.env.local` for local `vercel dev`:

| Variable | Where |
|----------|--------|
| `ANTHROPIC_API_KEY` | Server |
| `ANTHROPIC_MODEL` | Server, optional override (defaults to `claude-sonnet-4-5-20250929`) |
| `GENERATION_MODE` | Server, optional (`compact` by default, `full` for self-hosting) |
| `TURNSTILE_SECRET_KEY` | Server |
| `KV_REST_API_URL` | Server (from Vercel KV) |
| `KV_REST_API_TOKEN` | Server (from Vercel KV) |

**Turnstile site key (public):** set on the widget in `public/index.html`:

```html
data-sitekey="YOUR_TURNSTILE_SITE_KEY"
```

The site key is safe to expose in HTML; pairing **secret** key stays in `TURNSTILE_SECRET_KEY` only.

## Local development

```bash
npm install
cp .env.example .env.local   # or .env — both are gitignored
# Fill ANTHROPIC_API_KEY, TURNSTILE_SECRET_KEY; optional KV_* for local rate-limit tests
# Set your Turnstile site key in public/index.html (data-sitekey)
npx vercel dev
```

Open `http://localhost:3000`.

- **Without KV:** rate limiting is skipped with a server `console.warn` (Turnstile still required).
- **With KV:** link a KV store in the Vercel project; copy REST URL/token into `.env`.

## Deploy to Vercel

1. Push this repo to GitHub and import the project in Vercel (Hobby is fine).
2. **Settings → Environment Variables:** `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY`, and optionally `GENERATION_MODE=compact` (default).
3. **Storage → Create KV** and connect it to the project (`KV_REST_*` are injected automatically).
4. Ensure `public/index.html` uses **your** Turnstile site key and the widget allows your `*.vercel.app` domain (and custom domain if any).
5. Deploy. Confirm `api/generate` shows **Max Duration 60s** and includes `assets/**` (see `vercel.json`).

### Push to a new GitHub repo

```bash
git remote remove origin          # if still pointing at an old remote
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git add -A
git commit -m "Compact Vercel demo: template fill, Turnstile, KV rate limit"
git push -u origin main
```

(Use your own commit message if you prefer; only push after verifying no secrets in `git diff --cached`.)

## API

`POST /api/generate` — `multipart/form-data`

| Field | Required | Notes |
|-------|----------|--------|
| `inputType` | yes | `link` \| `text` \| `file` (`youtube` is disabled in compact mode) |
| `turnstileToken` | yes | From Cloudflare widget |
| `url` | link | Article URL |
| `text` | text | Pasted source |
| `file` | file | PDF, DOCX, PPTX, TXT, MD (max **4.5 MB**) |
| `focusAreas` | no | JSON object, e.g. `{"categories":["Scope 2"],"impactDimensions":["disclosure"]}` |

**Success (200):** `{ "html": "<!doctype html>..." }`

**Error (4xx/502):** `{ "error": "ERROR_CODE", "hint": "..." }`

Common codes: `FETCH_FAILED`, `LOGIN_WALL`, `CONTENT_TOO_LONG`, `FILE_PARSE_FAILED`, `CONFIDENTIAL`, `RATE_LIMIT`, `GENERATION_TIMEOUT`, `GENERATION_FAILED`.

## Limits & behaviour

- **Production rate limit:** 3 generations per IP per sliding 24 hours (after Turnstile, before Claude; requires KV). Local and preview environments skip this limit for testing.
- **Compact mode input limit:** about 2,200 extracted characters. Users should paste focused excerpts.
- **Compact mode timeout:** Claude calls time out before the Vercel Hobby 60s ceiling so the API can return a helpful `GENERATION_TIMEOUT` message.
- **No headless browser** — JS-heavy sites may fail → paste text instead.
- **LinkedIn** → `LOGIN_WALL`; paste post text manually.
- **YouTube links are disabled in compact mode** — paste a short transcript excerpt instead.
- **Confidential** markers in the first 500 characters → `CONFIDENTIAL` (no LLM). Claude may still return a sage error page for edge cases per `skill-prompt.md` §11.

## Project layout

```
assets/                 skill prompt + HTML template (read by API)
api/generate.js         serverless entry
lib/render-template.js  compact mode: fills template from Claude JSON parts
lib/                    extract, LLM, Turnstile, rate limit, multipart
public/                 static UI
vercel.json             60s timeout + includeFiles for assets
```

Example generated pages (`CPF_*.html`, `wef-*.html`) are sample outputs only, not required to run the app.

## License

Demo / learning use — review Anthropic and Cloudflare terms for production use.
