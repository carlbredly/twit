import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTwitterMedia, extractTweetId } from './twitterService';

describe('extractTweetId', () => {
  it('extrait l’identifiant depuis twitter.com, x.com et /i/status', () => {
    expect(extractTweetId('https://twitter.com/nasa/status/12345')).toBe('12345');
    expect(extractTweetId('https://x.com/nasa/status/999')).toBe('999');
    expect(extractTweetId('https://x.com/i/status/42')).toBe('42');
  });

  it('refuse une URL interne ou sans identifiant', () => {
    expect(extractTweetId('https://x.com/nasa')).toBeNull();
    expect(extractTweetId('http://127.0.0.1/x.com/a/status/1')).toBeNull();
  });
});

describe('downloadTwitterMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mappe les médias fxTwitter sûrs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            tweet: {
              media: {
                videos: [{ url: 'https://video.twimg.com/a.mp4', thumbnail_url: 'https://pbs.twimg.com/a.jpg' }],
                photos: [{ url: 'https://pbs.twimg.com/b.jpg' }],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const result = await downloadTwitterMedia('https://x.com/nasa/status/1');
    expect(result.success).toBe(true);
    expect(result.mediaItems).toHaveLength(2);
  });

  it('filtre une vidéo interne renvoyée par l’API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('fxtwitter')) {
          return new Response(
            JSON.stringify({
              tweet: { media: { videos: [{ url: 'http://169.254.169.254/steal' }] } },
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ media: [] }), { status: 200 });
      })
    );

    const result = await downloadTwitterMedia('https://x.com/nasa/status/1');
    expect(result.success).toBe(false);
  });
});
