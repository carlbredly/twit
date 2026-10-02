import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadThreadsMedia } from './threadsService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadThreadsMedia', () => {
  it('refuse un profil', async () => {
    const result = await downloadThreadsMedia('https://www.threads.net/@someone');
    expect(result.success).toBe(false);
  });

  it('refuse une URL privée', async () => {
    const result = await downloadThreadsMedia('http://127.0.0.1/@u/post/abc');
    expect(result.success).toBe(false);
  });

  it('parse une réponse générique valide', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          items: [{ url: 'https://scontent.cdninstagram.com/t.jpg', type: 'image' }],
        }),
      })
    );

    const result = await downloadThreadsMedia('https://www.threads.net/@alice/post/Dabc123');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toContain('cdninstagram.com');
  });
});
