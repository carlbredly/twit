import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTikTokMedia, extractTikTokId } from './tiktokService';

describe('extractTikTokId', () => {
  it('extrait l’id des formats longs et courts', () => {
    expect(extractTikTokId('https://www.tiktok.com/@user/video/1234567890123456789')).toBe(
      '1234567890123456789'
    );
    expect(extractTikTokId('https://vm.tiktok.com/ZMabcde')).toBe('ZMabcde');
    expect(extractTikTokId('https://www.tiktok.com/t/ZTxyz')).toBe('ZTxyz');
  });
});

describe('downloadTikTokMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retourne la vidéo HD si l’URL est sûre', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              hdplay: 'https://v16.tiktokcdn.com/hd.mp4',
              cover: 'https://p16.tiktokcdn.com/cover.jpg',
            },
          }),
          { status: 200 }
        )
      )
    );

    const result = await downloadTikTokMedia('https://www.tiktok.com/@user/video/1');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toContain('tiktokcdn.com');
  });

  it('bloque une URL média interne renvoyée par l’API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { play: 'http://127.0.0.1/steal.mp4' } }), { status: 200 })
      )
    );

    const result = await downloadTikTokMedia('https://www.tiktok.com/@user/video/1');
    expect(result.success).toBe(false);
  });
});
