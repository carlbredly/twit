export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

export function createRateLimiter(limit: number, windowMs: number) {
  const timestamps: number[] = [];

  return (now = Date.now()): RateLimitResult => {
    while (timestamps.length > 0 && now - timestamps[0] >= windowMs) {
      timestamps.shift();
    }

    if (timestamps.length >= limit) {
      const retryAfterMs = windowMs - (now - timestamps[0]);
      return { allowed: false, retryAfterMs, remaining: 0 };
    }

    timestamps.push(now);
    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, limit - timestamps.length),
    };
  };
}

export const SEARCH_RATE_LIMIT = 8;
export const SEARCH_RATE_WINDOW_MS = 60_000;
