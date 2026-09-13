import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('createRateLimiter', () => {
  it('autorise les requêtes sous la limite puis bloque', () => {
    const limit = createRateLimiter(2, 1000);
    const first = limit(1000);
    const second = limit(1001);
    const third = limit(1002);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it('réouvre la fenêtre après expiration', () => {
    const limit = createRateLimiter(1, 500);
    expect(limit(0).allowed).toBe(true);
    expect(limit(100).allowed).toBe(false);
    expect(limit(500).allowed).toBe(true);
  });
});
