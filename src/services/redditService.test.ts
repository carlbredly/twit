import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadRedditMedia } from './redditService';

describe('downloadRedditMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuse une URL invalide', async () => {
    const result = await downloadRedditMedia('https://www.reddit.com/r/pics/');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/i);
  });

  it('refuse une URL interne avant tout fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await downloadRedditMedia('http://127.0.0.1/r/pics/comments/abc12');
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('extrait une vidéo publique depuis le JSON Reddit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            data: {
              children: [
                {
                  data: {
                    secure_media: {
                      reddit_video: {
                        fallback_url: 'https://v.redd.it/abc/DASH_720.mp4',
                        width: 1280,
                        height: 720,
                      },
                    },
                    thumbnail: 'https://preview.redd.it/thumb.jpg',
                  },
                },
              ],
            },
          },
        ],
      })
    );

    const result = await downloadRedditMedia('https://www.reddit.com/r/videos/comments/abc12/demo/');
    expect(result.success).toBe(true);
    expect(result.platform).toBe('reddit');
    expect(result.mediaItems?.[0]).toMatchObject({
      url: 'https://v.redd.it/abc/DASH_720.mp4',
      type: 'video',
      quality: '720p',
    });
  });
});
