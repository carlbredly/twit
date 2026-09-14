import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTwitterMedia } from './twitterService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadTwitterMedia', () => {
  it('refuse une URL sans status', async () => {
    const result = await downloadTwitterMedia('https://x.com/someone');
    expect(result.success).toBe(false);
  });

  it('utilise le fallback vxTwitter', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          media: [{ type: 'photo', media_url_https: 'https://pbs.twimg.com/ok.jpg' }],
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadTwitterMedia('https://x.com/u/status/1');
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
