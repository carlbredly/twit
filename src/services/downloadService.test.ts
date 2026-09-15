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
});

describe('triggerDownload', () => {
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
