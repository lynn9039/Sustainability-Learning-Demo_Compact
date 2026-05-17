# Sustainability Learning Page — Vercel Demo

Turn a link, pasted text, document (PDF/DOCX/PPTX/TXT/MD), or YouTube URL into a **self-contained HTML learning page** (Summary · Interpretation · Insights) via Claude, styled with a sustainability analyst lens.

## Stack

- **Frontend:** `public/index.html`, `app.js`, `styles.css` (sage UI, iframe preview)
- **API:** `api/generate.js` (Node serverless, 60s, multipart)
- **LLM:** Anthropic Messages API — `claude-sonnet-4-5-20250929` by default, `max_tokens: 16000`
- **Prompt assets:** `assets/skill-prompt.md`, `assets/template.html` (bundled via `vercel.json` → `includeFiles`)
- **Abuse:** Cloudflare Turnstile + Vercel KV (3 attempts / IP / sliding 24h)

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel` or use `npx vercel`)
- [Anthropic API key](https://console.anthropic.com/)
- [Cloudflare Turnstile](https://dash.cloudflare.com/) widget (allow **localhost** in widget settings)
- [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (recommended for production rate limits)

## Environment variables

Copy `.env.example` to `.env` for local `vercel dev`:

| Variable | Where |
|----------|--------|
| `ANTHROPIC_API_KEY` | Server |
| `ANTHROPIC_MODEL` | Server, optional override (defaults to `claude-sonnet-4-5-20250929`) |
| `TURNSTILE_SECRET_KEY` | Server |
| `KV_REST_API_URL` | Server (from Vercel KV) |
| `KV_REST_API_TOKEN` | Server (from Vercel KV) |

**Turnstile site key (public):** hardcode in `public/index.html` on the Turnstile widget:

```html
data-sitekey="YOUR_TURNSTILE_SITE_KEY"
```

Replace `REPLACE_WITH_YOUR_SITE_KEY` before deploy. The site key is not secret; the secret key stays in `TURNSTILE_SECRET_KEY`.

## Local development

```bash
npm install
cp .env.example .env
# Edit .env and index.html (Turnstile site key)
npx vercel dev
```

Open `http://localhost:3000`.

- **Without KV:** rate limiting is skipped with a server `console.warn` (Turnstile still required).
- **With KV:** link a KV store in the Vercel project; copy REST URL/token into `.env`.

## Deploy to Vercel

1. Push the repo and import the project in Vercel (Hobby is fine).
2. **Settings → Environment Variables:** add `ANTHROPIC_API_KEY`, `TURNSTILE_SECRET_KEY`.
3. **Storage → Create KV** and connect it to the project (`KV_REST_*` are injected automatically).
4. Set the Turnstile **site key** in `public/index.html` (or use Preview/Production env-specific HTML if you split keys later).
5. Deploy. Confirm `api/generate` shows **Max Duration 60s** and includes `assets/**` (see `vercel.json`).

## API

`POST /api/generate` — `multipart/form-data`

| Field | Required | Notes |
|-------|----------|--------|
| `inputType` | yes | `link` \| `text` \| `file` \| `youtube` |
| `turnstileToken` | yes | From Cloudflare widget |
| `url` | link / youtube | Article or video URL |
| `text` | text | Pasted source |
| `file` | file | PDF, DOCX, PPTX, TXT, MD (max **4.5 MB**) |
| `focusAreas` | no | JSON object, e.g. `{"categories":["Scope 2"],"impactDimensions":["disclosure"]}` |

**Success (200):** `{ "html": "<!doctype html>..." }`

**Error (4xx/502):** `{ "error": "ERROR_CODE", "hint": "..." }`

Common codes: `FETCH_FAILED`, `LOGIN_WALL`, `NO_TRANSCRIPT`, `FILE_PARSE_FAILED`, `CONFIDENTIAL`, `RATE_LIMIT`, `GENERATION_FAILED`.

## Limits & behaviour

- **3 generations per IP per sliding 24 hours** (after Turnstile, before Claude; requires KV).
- **No headless browser** — JS-heavy sites may fail → paste text instead.
- **LinkedIn** → `LOGIN_WALL`; paste post text manually.
- **YouTube** without captions → `NO_TRANSCRIPT`.
- **Confidential** markers in the first 500 characters → `CONFIDENTIAL` (no LLM). Claude may still return a sage error page for edge cases per `skill-prompt.md` §11.

## Project layout

```
assets/           skill prompt + HTML template (read by API)
api/generate.js   serverless entry
lib/              extract, LLM, Turnstile, rate limit, multipart
public/           static UI
vercel.json       60s timeout + includeFiles for assets
```

## License

Demo / learning use — review Anthropic and Cloudflare terms for production use.
