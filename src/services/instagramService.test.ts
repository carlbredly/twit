import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadInstagramMedia, extractInstagramShortcode } from './instagramService';

describe('extractInstagramShortcode', () => {
  it('extrait le shortcode des formats supportés', () => {
    expect(extractInstagramShortcode('https://www.instagram.com/p/AbC_12/')).toBe('AbC_12');
    expect(extractInstagramShortcode('https://instagram.com/reel/Reel99')).toBe('Reel99');
    expect(extractInstagramShortcode('https://instagram.com/reels/Reel99')).toBe('Reel99');
  });

  it('refuse profils et URLs dangereuses', () => {
    expect(extractInstagramShortcode('https://instagram.com/nasa')).toBeNull();
    expect(extractInstagramShortcode('javascript:alert(1)')).toBeNull();
  });
});

describe('downloadInstagramMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('utilise la première API ajax qui répond', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            status: 'ok',
            items: [{ url: 'https://scontent.cdninstagram.com/v.mp4', type: 'video' }],
          }),
          { status: 200 }
        )
      )
    );

    const result = await downloadInstagramMedia('https://instagram.com/p/AbC123');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].type).toBe('video');
  });

  it('ignore un média javascript injecté dans la réponse API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('ajaxSearch')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              items: [{ url: 'javascript:alert(1)', type: 'image' }],
            }),
            { status: 200 }
          );
        }
        return new Response('', { status: 404 });
      })
    );

    const result = await downloadInstagramMedia('https://instagram.com/p/AbC123');
    expect(result.success).toBe(false);
  });
});
