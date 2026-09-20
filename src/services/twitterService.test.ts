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

  it('expose toutes les qualités MP4 avec labels HD (comme ssstwitter)', async () => {
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
                    url: 'https://video.twimg.com/amplify_video/1/vid/1280x720/best.mp4',
                    thumbnail_url: 'https://pbs.twimg.com/thumb.jpg',
                    width: 1280,
                    height: 720,
                    variants: [
                      {
                        url: 'https://video.twimg.com/amplify_video/1/pl/x.m3u8',
                        bitrate: 0,
                        content_type: 'application/x-mpegURL',
                      },
                      {
                        url: 'https://video.twimg.com/amplify_video/1/vid/320x180/low.mp4',
                        bitrate: 320000,
                        content_type: 'video/mp4',
                      },
                      {
                        url: 'https://video.twimg.com/amplify_video/1/vid/640x360/mid.mp4',
                        bitrate: 832000,
                        content_type: 'video/mp4',
                      },
                      {
                        url: 'https://video.twimg.com/amplify_video/1/vid/1280x720/best.mp4',
                        bitrate: 2176000,
                        content_type: 'video/mp4',
                      },
                    ],
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
    // 3 video qualities + 1 gif + 1 image
    expect(result.mediaItems).toHaveLength(5);
    expect(result.mediaItems?.[0].label).toBe('Download HD 1280x720');
    expect(result.mediaItems?.[1].label).toBe('Download 640x360');
    expect(result.mediaItems?.[2].label).toBe('Download 320x180');
    expect(result.mediaItems?.[3]).toMatchObject({
      type: 'gif',
      url: 'https://video.twimg.com/tweet_video/gif.mp4',
    });
    expect(result.mediaItems?.[4]).toMatchObject({
      type: 'image',
      label: 'Download Image',
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
                url: 'https://video.twimg.com/ext_tw_video/fallback/vid/720x1280/x.mp4',
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
    expect(result.mediaItems?.[0].url).toContain('fallback');
    expect(result.mediaItems?.[0].label).toMatch(/Download/);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.vxtwitter.com/i/status/9876543210',
      expect.any(Object)
    );
  });
});
