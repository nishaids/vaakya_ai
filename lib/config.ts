// Shared configuration for VAAKYA AI — single source of truth for model IDs,
// retry budgets, timeouts, rate limits, and upload limits.
// Safe to import from both server routes and client components (no server-only APIs).

// When Google retires models, update this list or set the GEMINI_MODELS env var
// (comma-separated) with current IDs from https://ai.google.dev/gemini-api/docs/models
export const GEMINI_DEFAULT_MODELS: readonly string[] = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
];

export const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

// --- Serverless budgets (Vercel Hobby: 60s max duration, ~4.5MB request body) ---
// Note: both API routes also declare `export const maxDuration = 60` as a
// literal — Next.js requires route segment config to be statically analyzable,
// so it cannot be imported from here. Keep them in sync.
export const ROUTE_MAX_DURATION_SECONDS = 60;

export const ANALYZE_FETCH_TIMEOUT_MS = 45_000;
export const CHAT_FETCH_TIMEOUT_MS = 30_000;

// 429 retry waits per model (attempt 1 → attempt 2). Total retry time across
// all models is additionally capped by RETRY_BUDGET_MS so we never blow past
// the function's maxDuration.
export const ANALYZE_RETRY_DELAYS_MS: readonly number[] = [2_000, 5_000];
export const CHAT_RETRY_DELAYS_MS: readonly number[] = [2_000, 4_000];
export const RETRY_BUDGET_MS = 40_000;

// Gemini 2.5+/3.x "thinking" tokens count against maxOutputTokens, so the
// budget must cover reasoning + the full JSON answer. 4096 was observed
// truncating real analyses (finishReason=MAX_TOKENS).
export const ANALYZE_MAX_OUTPUT_TOKENS = 8192;
export const CHAT_MAX_OUTPUT_TOKENS = 1024;

// --- Per-IP rate limits (in-memory, per serverless instance) ---
export const ANALYZE_RATE_LIMIT = { limit: 10, windowMs: 60_000 };
export const CHAT_RATE_LIMIT = { limit: 30, windowMs: 60_000 };

// --- Upload limits ---
// 3MB binary ≈ 4MB after base64 — stays under Vercel's ~4.5MB body cap.
// To support bigger PDFs later, switch to the Gemini Files API or a
// direct-to-storage upload instead of inline base64 through the route.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "3MB";
// Server-side mirror of the client cap (base64 chars ≈ bytes × 4/3, plus padding).
export const MAX_BASE64_LENGTH = Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 4;

// Extension → mime type allowlist for inline (base64) uploads. .txt is handled
// separately: read as text client-side and sent as a text part.
export const INLINE_UPLOAD_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export const TEXT_UPLOAD_EXTENSIONS: readonly string[] = ["txt"];
export const UPLOAD_ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,.webp,.txt";
