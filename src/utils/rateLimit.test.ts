import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('createRateLimiter', () => {
  it('autorise jusqu’à la limite puis bloque', () => {
    const limiter = createRateLimiter(2, 1000);
    const first = limiter(1_000);
    const second = limiter(1_100);
    const third = limiter(1_200);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it('réouvre la fenêtre après expiration', () => {
    const limiter = createRateLimiter(1, 500);
    expect(limiter(0).allowed).toBe(true);
    expect(limiter(100).allowed).toBe(false);
    expect(limiter(500).allowed).toBe(true);
  });
});
