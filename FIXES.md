# VAAKYA AI — API Fix Summary (July 2026)

## Root cause

All three models in the fallback array (`gemini-2.0-flash`, `gemini-2.0-flash-001`,
`gemini-2.0-flash-lite`) were **shut down by Google on June 1, 2026**. Every request
returned 404, both routes treated 404 as "try next model", so all calls ended in
`503 All models exhausted`. The chain was also never real redundancy —
`gemini-2.0-flash` is an alias of `gemini-2.0-flash-001` (same model, same quota).

## ⚠️ Manual steps YOU must do (the code fix alone is not enough)

1. **Rotate the Gemini API key** — the old one was exposed in a shared zip.
   Google AI Studio → https://aistudio.google.com/apikey → delete old key, create new.
2. **Set `GEMINI_API_KEY` on Vercel** — Project → Settings → Environment Variables.
   `.env.local` never deploys to Vercel; if the variable isn't set there, production
   fails with "GEMINI_API_KEY is not configured" regardless of these fixes. Check
   whether it was ever set — that may have been an additional production failure.
3. **Redeploy** so the new env var takes effect.
4. Optional: set `GEMINI_MODELS` (comma-separated) on Vercel to swap models without
   a code change — needed by **Oct 16, 2026** when `gemini-2.5-flash` retires.

## What changed

### New files

- **`lib/config.ts`** — every model ID, timeout, retry delay, rate limit, and upload
  limit as a named constant. Client-safe (imported by components too).
  Default model chain: `gemini-2.5-flash` → `gemini-2.5-flash-lite` (verified current
  on https://ai.google.dev/gemini-api/docs/models as of July 2026), overridable via
  the `GEMINI_MODELS` env var.
- **`lib/gemini.ts`** — shared server helper `callGeminiWithFallback()`:
  - API key sent via `x-goog-api-key` **header**, never in the URL (the old
    `?key=...` leaked the key into logs/proxies).
  - Walks the model chain on 404 (retired model → clear log message), retries 429
    with short waits (honoring `Retry-After` when present), all capped by a 40s
    total retry budget so the function never outlives Vercel's 60s limit
    (old code could wait ~135s per model).
  - Every fetch wrapped in `AbortSignal.timeout(...)` (45s analyze / 30s chat) so a
    hung upstream can't eat the whole function duration.
  - Logs which model actually served each request.
- **`lib/rateLimit.ts`** — dependency-free in-memory sliding-window limiter per IP:
  10 req/min on `/api/analyze`, 30 req/min on `/api/chat`, returns 429 JSON with
  `Retry-After`. (Per-instance memory — enough to stop casual quota-burning; use a
  shared store like Upstash if you ever need hard guarantees.)

### `app/api/analyze/route.ts`

- `export const runtime = "nodejs"` and `export const maxDuration = 60` added.
- Uses the shared helper (model chain, header auth, timeout, retry budget).
- `generationConfig` now has `responseMimeType: "application/json"` **and** a full
  `responseSchema`, so Gemini returns strict JSON; the old regex cleanup
  (`parseGeminiJson`) is kept only as a defensive fallback.
- `maxOutputTokens` raised 2048 → 4096 (2048 truncated multi-violation responses
  mid-JSON → parse crash → generic 500).
- `finishReason === "MAX_TOKENS"` → specific 502 "analysis was cut off".
- `promptFeedback.blockReason` and empty `candidates` → specific 422
  "document could not be analyzed" (legal docs can trip safety filters).
- Server-side 413 guard mirroring the 3MB client cap.
- Accepts `{ textData }` in addition to `{ base64Data, mimeType }` (for .txt uploads).
- Per-IP rate limiting (429 + `Retry-After`).

### `app/api/chat/route.ts`

- Same: `runtime`, `maxDuration`, shared helper, header auth, 30s fetch timeout,
  rate limiting.
- **Now retries 429s** (2s/4s waits) — previously a single rate-limit response
  failed the whole request. 429 exhaustion returns a specific "high traffic" body.
- Stream pump wrapped in try/catch so a mid-stream upstream abort ends the response
  cleanly instead of crashing.

### `components/DemoSection.tsx`

- **File size cap 10MB → 3MB** (≈4MB after base64 — under Vercel's ~4.5MB body
  limit, which was silently 413-ing larger uploads before the route even ran).
  Longer-term option for big PDFs: Gemini Files API or direct-to-storage upload
  (noted in `lib/config.ts`).
- `getMimeType` no longer defaults unknown files to fake `image/jpeg`: explicit
  allowlist (pdf, jpg, jpeg, png, webp), `.txt` is read as text and sent as
  `textData`, everything else rejected client-side with a friendly message.
  `<input accept>` synced to the allowlist.
- Distinct human-readable errors for: file too large (pre-upload), unsupported
  type (pre-upload), 413, 429 (quota), 422 (blocked/unreadable), 503 (models
  unavailable), 504 (timeout), network failure. The expo-friendly fallback to demo
  results is kept, but the toast now says *why* it fell back.

### `components/VaakyaChatbot.tsx`

- Canned `getSmartResponse()` fallback kept (good for expo demos) but fallback
  replies now carry an `offline: true` flag rendered as a "⚡ offline mode" badge,
  and the real HTTP status/body is logged via `console.error` — the backend can no
  longer die silently.

### Housekeeping

- Deleted the stray `nul` file (Windows artifact). Verified `.next/` and
  `.env.local` are gitignored and not tracked in git.
- README: added the key-rotation / Vercel env var instructions.

## Config knobs (all in `lib/config.ts`)

| Constant | Value |
|---|---|
| `GEMINI_DEFAULT_MODELS` | `gemini-2.5-flash`, `gemini-2.5-flash-lite` |
| `ANALYZE_FETCH_TIMEOUT_MS` / `CHAT_FETCH_TIMEOUT_MS` | 45s / 30s |
| `ANALYZE_RETRY_DELAYS_MS` / `CHAT_RETRY_DELAYS_MS` | 2s, 5s / 2s, 4s |
| `RETRY_BUDGET_MS` | 40s total |
| `ANALYZE_MAX_OUTPUT_TOKENS` | 4096 |
| `ANALYZE_RATE_LIMIT` / `CHAT_RATE_LIMIT` | 10/min / 30/min per IP |
| `MAX_UPLOAD_BYTES` | 3MB |

(`maxDuration = 60` is a literal in each route because Next.js requires segment
config to be statically analyzable — keep in sync with
`ROUTE_MAX_DURATION_SECONDS`.)
