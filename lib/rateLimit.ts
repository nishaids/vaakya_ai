// Dependency-free sliding-window rate limiter, keyed per IP. State is
// per-serverless-instance (in-memory), which is enough to stop casual abuse
// from burning the free-tier Gemini quota; a determined attacker hitting many
// cold instances would need a shared store (e.g. Upstash) instead.

const buckets = new Map<string, number[]>();
// Safety valve so a scan across many spoofed IPs can't grow memory unbounded.
const MAX_TRACKED_KEYS = 5_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    const retryAfterSeconds = Math.max(
      Math.ceil((recent[0] + windowMs - now) / 1000),
      1
    );
    return { allowed: false, retryAfterSeconds };
  }

  if (buckets.size >= MAX_TRACKED_KEYS && !buckets.has(key)) {
    buckets.clear();
  }
  recent.push(now);
  buckets.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Client IP as Vercel reports it (first hop of x-forwarded-for). */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
