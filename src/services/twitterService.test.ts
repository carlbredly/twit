import { describe, expect, it, vi, afterEach } from 'vitest';
import { downloadTwitterMedia } from './twitterService';

describe('downloadTwitterMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejette une URL invalide', async () => {
    const result = await downloadTwitterMedia('https://x.com/home');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/i);
  });

  it('parse vidéos, images et GIFs fxTwitter (GIF via type gif dans videos)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            tweet: {
              media: {
                videos: [
                  {
                    type: 'video',
                    url: 'https://video.twimg.com/ext_tw_video/1.mp4',
                    thumbnail_url: 'https://pbs.twimg.com/thumb1.jpg',
                  },
                  {
                    type: 'gif',
                    url: 'https://video.twimg.com/tweet_video/gif.mp4',
                    thumbnail_url: 'https://pbs.twimg.com/thumb2.jpg',
                  },
                ],
                photos: [
                  {
                    url: 'https://pbs.twimg.com/media/photo.jpg?name=orig',
                  },
                ],
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    const result = await downloadTwitterMedia('https://x.com/user/status/1234567890');
    expect(result.success).toBe(true);
    expect(result.mediaItems).toHaveLength(3);
    expect(result.mediaItems?.[0]).toMatchObject({
      type: 'video',
      url: 'https://video.twimg.com/ext_tw_video/1.mp4',
    });
    expect(result.mediaItems?.[1]).toMatchObject({
      type: 'gif',
      url: 'https://video.twimg.com/tweet_video/gif.mp4',
    });
    expect(result.mediaItems?.[2]).toMatchObject({
      type: 'image',
      url: 'https://pbs.twimg.com/media/photo.jpg?name=orig',
    });
  });

  it('utilise le fallback vxTwitter media_extended', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tweet: null }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            media_extended: [
              {
                type: 'video',
                url: 'https://video.twimg.com/ext_tw_video/fallback.mp4',
                thumbnail_url: 'https://pbs.twimg.com/thumb.jpg',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadTwitterMedia('https://twitter.com/user/status/9876543210');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toContain('fallback.mp4');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.vxtwitter.com/i/status/9876543210',
      expect.any(Object)
    );
  });
});
