// Server-side Gemini helper: model-chain fallback, 429 retry with a hard time
// budget, header-based auth, and per-request fetch timeouts. Used by both
// /api/analyze and /api/chat so model swaps are a one-line change in config.ts
// (or a GEMINI_MODELS env var change — no redeploy of code needed).

import {
  GEMINI_API_BASE,
  GEMINI_DEFAULT_MODELS,
  GEMINI_TOTAL_BUDGET_MS,
} from "./config";

export function getGeminiModels(): string[] {
  const fromEnv = process.env.GEMINI_MODELS;
  if (fromEnv) {
    const models = fromEnv
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    if (models.length > 0) return models;
  }
  return [...GEMINI_DEFAULT_MODELS];
}

// Minimal shapes of the Gemini generateContent response we actually read.
export interface GeminiPart {
  text?: string;
}
export interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string;
}
export interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
}

export interface GeminiCallOptions {
  apiKey: string;
  endpoint: "generateContent" | "streamGenerateContent";
  /** Append ?alt=sse for streaming endpoints. */
  sse?: boolean;
  body: Record<string, unknown>;
  timeoutMs: number;
  /** Waits between 429 retries for a single model; length = max retries. */
  retryDelaysMs: readonly number[];
  logTag: string;
}

export type GeminiCallResult =
  | { ok: true; response: Response; model: string }
  | { ok: false; status: number; error: string; details?: string };

function parseRetryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(date - Date.now(), 0);
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Calls Gemini, walking the model chain on 404 (model retired) and retrying
 * 429s per model (honoring Retry-After when present). All retry waits share a
 * single RETRY_BUDGET_MS deadline so the route never outlives Vercel's
 * maxDuration. Returns the raw upstream Response on success so callers can
 * either .json() it or re-stream the body.
 */
export async function callGeminiWithFallback(
  options: GeminiCallOptions
): Promise<GeminiCallResult> {
  const { apiKey, endpoint, sse, body, timeoutMs, retryDelaysMs, logTag } =
    options;
  const models = getGeminiModels();
  // Hard wall-clock budget for the WHOLE chain — fetches count too, not just
  // retry waits, so a hanging primary model can't eat the fallback's slot.
  const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;
  const payload = JSON.stringify(body);
  let sawRateLimit = false;
  let sawServerError = false;
  let sawTimeout = false;

  for (const model of models) {
    const url = `${GEMINI_API_BASE}/${model}:${endpoint}${sse ? "?alt=sse" : ""}`;

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      const remainingMs = deadline - Date.now();
      if (remainingMs < 3_000) {
        console.warn(`[${logTag}] chain budget exhausted before model=${model}`);
        break;
      }

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Header auth — the key must never appear in the URL, where it
            // would leak into request logs and proxies.
            "x-goog-api-key": apiKey,
          },
          body: payload,
          signal: AbortSignal.timeout(Math.min(timeoutMs, remainingMs)),
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.name === "TimeoutError" || err.name === "AbortError")
        ) {
          // Model hanging under load — treat as transient and let the next
          // model in the chain take over instead of failing the request.
          console.error(`[${logTag}] model=${model} timed out — trying next model`);
          sawTimeout = true;
          break;
        }
        console.error(`[${logTag}] model=${model} network error — trying next model:`, err);
        sawServerError = true;
        break;
      }

      if (response.ok) {
        console.log(
          `[${logTag}] served by model=${model} (attempt ${attempt + 1})`
        );
        return { ok: true, response, model };
      }

      if (response.status === 404) {
        // Model retired or renamed — permanent, not transient. Next model.
        console.error(
          `[${logTag}] model=${model} → 404: model ID no longer exists. ` +
            `Update GEMINI_MODELS (env var or lib/config.ts).`
        );
        break;
      }

      // 429 (quota) and 5xx (overloaded/unavailable) are transient: one quick
      // retry, then fall through to the next model in the chain.
      if (response.status === 429 || response.status >= 500) {
        if (response.status === 429) sawRateLimit = true;
        else sawServerError = true;
        if (attempt >= retryDelaysMs.length) break;
        const waitMs = parseRetryAfterMs(response) ?? retryDelaysMs[attempt];
        if (Date.now() + waitMs >= deadline) {
          console.warn(
            `[${logTag}] model=${model} status=${response.status}; retry would exceed budget — moving on`
          );
          break;
        }
        console.warn(
          `[${logTag}] model=${model} status=${response.status} (attempt ${attempt + 1}), waiting ${waitMs}ms`
        );
        await sleep(waitMs);
        continue;
      }

      // 400/401/403 etc. — retrying or switching models won't help; surface it.
      const details = (await response.text().catch(() => "")).slice(0, 500);
      console.error(
        `[${logTag}] model=${model} → ${response.status}: ${details}`
      );
      return {
        ok: false,
        status: response.status,
        error: `Gemini API error ${response.status}`,
        details,
      };
    }
  }

  // Whole chain failed — pick the most accurate user-facing explanation.
  if (sawServerError || sawRateLimit) {
    return {
      ok: false,
      status: sawServerError ? 503 : 429,
      error:
        "The AI service is temporarily overloaded. Please try again in a minute.",
    };
  }
  if (sawTimeout) {
    return {
      ok: false,
      status: 504,
      error: "The AI service did not respond in time. Please try again.",
    };
  }
  return {
    ok: false,
    status: 503,
    error:
      "No configured Gemini model is available (all returned 404 — the model IDs are likely retired). Update GEMINI_MODELS.",
  };
}
