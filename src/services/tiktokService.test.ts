import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTikTokMedia } from './tiktokService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadTikTokMedia', () => {
  it('refuse une URL non TikTok', async () => {
    const result = await downloadTikTokMedia('https://example.com/video/1');
    expect(result.success).toBe(false);
  });

  it('parse une réponse API valide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: { play: 'https://v16.tiktokcdn.com/ok.mp4' },
        }),
      })
    );
    const result = await downloadTikTokMedia('https://www.tiktok.com/@u/video/1');
    expect(result.success).toBe(true);
  });
});
