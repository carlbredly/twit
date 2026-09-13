import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTwitterMedia } from './twitterService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadTwitterMedia', () => {
  it('rejette une URL Twitter invalide', async () => {
    const result = await downloadTwitterMedia('https://x.com/home');
    expect(result.success).toBe(false);
  });

  it('utilise fxTwitter puis renvoie les médias parsés', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            tweet: {
              media: {
                photos: [{ url: 'https://pbs.twimg.com/media.jpg' }],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const result = await downloadTwitterMedia('https://x.com/user/status/42');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toBe('https://pbs.twimg.com/media.jpg');
  });
});
