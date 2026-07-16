// Server-side Gemini helper: model-chain fallback, 429 retry with a hard time
// budget, header-based auth, and per-request fetch timeouts. Used by both
// /api/analyze and /api/chat so model swaps are a one-line change in config.ts
// (or a GEMINI_MODELS env var change — no redeploy of code needed).

import {
  GEMINI_API_BASE,
  GEMINI_DEFAULT_MODELS,
  RETRY_BUDGET_MS,
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
  const deadline = Date.now() + RETRY_BUDGET_MS;
  const payload = JSON.stringify(body);
  let sawRateLimit = false;
  let sawServerError = false;

  for (const model of models) {
    const url = `${GEMINI_API_BASE}/${model}:${endpoint}${sse ? "?alt=sse" : ""}`;

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
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
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (
          err instanceof Error &&
          (err.name === "TimeoutError" || err.name === "AbortError")
        ) {
          console.error(`[${logTag}] model=${model} timed out after ${timeoutMs}ms`);
          return {
            ok: false,
            status: 504,
            error: "The AI service did not respond in time. Please try again.",
          };
        }
        console.error(`[${logTag}] model=${model} network error:`, err);
        return {
          ok: false,
          status: 502,
          error: "Could not reach the AI service. Please try again.",
        };
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

      // 429 (quota) and 5xx (overloaded/unavailable) are transient: retry with
      // a short wait, then fall through to the next model in the chain.
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

  if (sawRateLimit) {
    return {
      ok: false,
      status: 429,
      error:
        "The AI service is receiving too much traffic right now. Please try again in a minute.",
    };
  }
  if (sawServerError) {
    return {
      ok: false,
      status: 503,
      error:
        "The AI service is temporarily overloaded. Please try again in a few minutes.",
    };
  }
  return {
    ok: false,
    status: 503,
    error:
      "No configured Gemini model is available (all returned 404 — the model IDs are likely retired). Update GEMINI_MODELS.",
  };
}
