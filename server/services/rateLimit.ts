/**
 * Small fixed-window rate limiter kept in memory.
 *
 * It protects the server's Gemini key from being drained by one client.
 * On serverless hosts each warm instance keeps its own window, which is
 * acceptable for a demo; a shared store (Redis, Upstash) would be the next step.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset(): void;
}

export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const { limit, windowMs } = options;
  const now = options.now ?? Date.now;
  const windows = new Map<string, { startedAt: number; count: number }>();

  function sweep(currentTime: number) {
    if (windows.size < 5_000) return;
    for (const [key, entry] of windows) {
      if (currentTime - entry.startedAt >= windowMs) windows.delete(key);
    }
  }

  return {
    check(rawKey: string): RateLimitResult {
      const key = rawKey || "unknown";
      const currentTime = now();
      sweep(currentTime);

      const entry = windows.get(key);
      if (!entry || currentTime - entry.startedAt >= windowMs) {
        windows.set(key, { startedAt: currentTime, count: 1 });
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
      }

      if (entry.count >= limit) {
        const retryAfterMs = windowMs - (currentTime - entry.startedAt);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }

      entry.count += 1;
      return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 };
    },
    reset() {
      windows.clear();
    },
  };
}

export function rateLimitedBody(retryAfterSeconds: number) {
  return {
    error: {
      code: "RATE_LIMITED",
      message: `Too many summaries from this connection. Please wait ${retryAfterSeconds}s and try again.`,
    },
  };
}
