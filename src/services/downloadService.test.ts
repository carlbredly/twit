import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadMedia, triggerDownload } from './downloadService';
import { MAX_MEDIA_BYTES } from '../utils/security';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downloadMedia', () => {
  it('refuse une URL privée avant tout fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await downloadMedia('http://127.0.0.1/p/abc', 'instagram');
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuse une plateforme inconnue', async () => {
    const result = await downloadMedia('https://example.com/video.mp4', 'unknown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/non supportée/);
  });

  it('route TikTok vers l’API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: { play: 'https://v16.tiktokcdn.com/a.mp4' },
        }),
      })
    );

    const result = await downloadMedia(
      'https://www.tiktok.com/@user/video/1234567890123456789',
      'tiktok'
    );
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toBe('https://v16.tiktokcdn.com/a.mp4');
  });

  it('route Twitter et ignore les médias internes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tweet: {
            media: {
              photos: [
                { url: 'https://pbs.twimg.com/ok.jpg' },
                { url: 'http://192.168.0.12/secret.jpg' },
              ],
            },
          },
        }),
      })
    );

    const result = await downloadMedia('https://x.com/user/status/99', 'twitter');
    expect(result.success).toBe(true);
    expect(result.mediaItems).toHaveLength(1);
  });

  it('route Threads vers le parseur générique', async () => {
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

    const result = await downloadMedia(
      'https://www.threads.net/@alice/post/Dabc123xyz',
      'threads'
    );
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].type).toBe('image');
  });

  it('route Bluesky vers l’API publique AT Protocol', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          thread: {
            post: {
              author: { did: 'did:plc:alice' },
              embed: {
                $type: 'app.bsky.embed.images#view',
                images: [{ fullsize: 'https://cdn.bsky.app/img/full.jpg', thumb: 'https://cdn.bsky.app/img/thumb.jpg' }],
              },
            },
          },
        }),
      })
    );

    const result = await downloadMedia(
      'https://bsky.app/profile/alice.bsky.social/post/3k2abcdef',
      'bluesky'
    );
    expect(result.success).toBe(true);
    expect(result.platform).toBe('bluesky');
    expect(result.mediaItems?.[0].url).toBe('https://cdn.bsky.app/img/full.jpg');
  });

  it('route Reddit vers le JSON public et ignore les médias internes', async () => {
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
                    url_overridden_by_dest: 'https://i.redd.it/ok.jpg',
                    preview: {
                      images: [{ source: { url: 'http://169.254.169.254/meta.jpg' } }],
                    },
                  },
                },
              ],
            },
          },
        ],
      })
    );

    const result = await downloadMedia(
      'https://www.reddit.com/r/pics/comments/abc12de/ok/',
      'reddit'
    );
    expect(result.success).toBe(true);
    expect(result.platform).toBe('reddit');
    expect(result.mediaItems).toHaveLength(1);
    expect(result.mediaItems?.[0].url).toBe('https://i.redd.it/ok.jpg');
  });
});

describe('triggerDownload (ssstwitter-style native download)', () => {
  it('ouvre un lien proxy same-origin (pas de fetch blob)', async () => {
    const click = vi.fn();
    const created: { href: string; downloadAttr: string } = { href: '', downloadAttr: '' };

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'a') {
        return document.createElement.bind(document)(tag);
      }
      const el = {
        href: '',
        rel: '',
        setAttribute(name: string, value: string) {
          if (name === 'download') created.downloadAttr = value;
        },
        click,
      };
      Object.defineProperty(el, 'href', {
        get() {
          return created.href;
        },
        set(v: string) {
          created.href = v;
        },
      });
      return el as unknown as HTMLAnchorElement;
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    await triggerDownload(
      'https://video.twimg.com/amplify_video/1/vid/1280x720/x.mp4',
      'clip-hd',
      'video'
    );

    expect(click).toHaveBeenCalled();
    expect(created.href).toContain('/api/media-proxy?');
    expect(created.href).toContain('video.twimg.com');
    expect(created.downloadAttr).toBe('clip-hd.mp4');
  });

  it('utilise .mp4 pour les GIFs Twitter', async () => {
    const click = vi.fn();
    let downloadAttr = '';
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'a') return {} as HTMLAnchorElement;
      return {
        href: '',
        rel: '',
        setAttribute(name: string, value: string) {
          if (name === 'download') downloadAttr = value;
        },
        click,
      } as unknown as HTMLAnchorElement;
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    await triggerDownload('https://video.twimg.com/tweet_video/x.mp4', 'anim', 'gif');
    expect(downloadAttr).toBe('anim.mp4');
    expect(click).toHaveBeenCalled();
  });

  it('refuse javascript:', async () => {
    await expect(triggerDownload('javascript:alert(1)', 'file', 'image')).rejects.toThrow();
  });

  it('refuse un HTML déguisé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://cdn.example.com/page',
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        blob: async () => new Blob(['<html></html>'], { type: 'text/html' }),
      })
    );

    await expect(triggerDownload('https://cdn.example.com/page', 'file', 'image')).rejects.toThrow(
      /non autorisé/
    );
  });

  it('refuse un fichier trop volumineux', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://cdn.example.com/huge.mp4',
        headers: {
          get: (name: string) =>
            name === 'content-length' ? String(MAX_MEDIA_BYTES + 1) : 'video/mp4',
        },
        blob: async () => new Blob(['x']),
      })
    );

    await expect(triggerDownload('https://cdn.example.com/huge.mp4', 'file', 'video')).rejects.toThrow(
      /volumineux/
    );
  });

  it('refuse une redirection vers un hôte privé', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: 'http://127.0.0.1/stolen',
        headers: { get: () => 'video/mp4' },
        blob: async () => new Blob(['x'], { type: 'video/mp4' }),
      })
    );

    await expect(triggerDownload('https://cdn.example.com/video.mp4', 'file', 'video')).rejects.toThrow(
      /non autorisé/
    );
  });
});
