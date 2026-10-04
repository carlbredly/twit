import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadVimeoMedia } from './vimeoService';

describe('downloadVimeoMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejette une page d’accueil sans ID', async () => {
    const result = await downloadVimeoMedia('https://vimeo.com/watch');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/i);
  });

  it('extrait les qualités progressives et ignore les URLs internes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          video: {
            thumbs: { '640': 'https://i.vimeocdn.com/video/thumb.jpg' },
          },
          request: {
            files: {
              progressive: [
                {
                  quality: '1080p',
                  width: 1920,
                  height: 1080,
                  url: 'https://vod-progressive.akamaized.net/hd.mp4',
                },
                {
                  quality: '720p',
                  width: 1280,
                  height: 720,
                  url: 'https://vod-progressive.akamaized.net/sd.mp4',
                },
                {
                  quality: '240p',
                  url: 'http://127.0.0.1/secret.mp4',
                },
              ],
            },
          },
        }),
      })
    );

    const result = await downloadVimeoMedia('https://vimeo.com/123456789');
    expect(result.success).toBe(true);
    expect(result.platform).toBe('vimeo');
    expect(result.mediaItems).toHaveLength(2);
    expect(result.mediaItems?.[0].quality).toBe('1080p');
    expect(result.mediaItems?.[0].url).toBe('https://vod-progressive.akamaized.net/hd.mp4');
    expect(result.mediaItems?.every((item) => !item.url.includes('127.0.0.1'))).toBe(true);
  });

  it('utilise oEmbed si le player config est vide', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request: { files: { progressive: [] } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          thumbnail_url: 'https://i.vimeocdn.com/video/preview.jpg',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadVimeoMedia('https://player.vimeo.com/video/987654321');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].type).toBe('image');
    expect(result.mediaItems?.[0].url).toBe('https://i.vimeocdn.com/video/preview.jpg');
  });

  it('passe par le proxy métadonnées si le fetch direct échoue', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          request: {
            files: {
              progressive: [
                { quality: '720p', url: 'https://vod-progressive.akamaized.net/ok.mp4' },
              ],
            },
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadVimeoMedia('https://vimeo.com/123456789');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toBe('https://vod-progressive.akamaized.net/ok.mp4');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/meta-proxy?');
  });

  it('signale une vidéo sans média public', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );

    const result = await downloadVimeoMedia('https://vimeo.com/111222333');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/privée|restreinte|supprimée/i);
  });
});
