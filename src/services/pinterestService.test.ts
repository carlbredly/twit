import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadPinterestMedia } from './pinterestService';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downloadPinterestMedia', () => {
  it('refuse une URL invalide', async () => {
    const result = await downloadPinterestMedia('https://www.pinterest.com/someone/');
    expect(result.success).toBe(false);
    expect(result.platform).toBe('pinterest');
  });

  it('refuse une URL privée avant tout fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await downloadPinterestMedia('http://127.0.0.1/pin/123');
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('extrait les images pidgets et ignore les hôtes internes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              images: {
                orig: { url: 'https://i.pinimg.com/originals/ab/cd/ok.jpg', width: 1200, height: 1800 },
                '237x': { url: 'http://169.254.169.254/meta.jpg', width: 237, height: 355 },
              },
            },
          ],
        }),
      })
    );

    const result = await downloadPinterestMedia('https://www.pinterest.com/pin/123456789012/');
    expect(result.success).toBe(true);
    expect(result.platform).toBe('pinterest');
    expect(result.mediaItems).toHaveLength(1);
    expect(result.mediaItems?.[0].url).toBe('https://i.pinimg.com/originals/ab/cd/ok.jpg');
    expect(result.mediaItems?.[0].quality).toBe('orig');
  });

  it('utilise oEmbed si pidgets est vide', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          thumbnail_url: 'https://i.pinimg.com/236x/aa/bb/cc/preview.jpg',
          thumbnail_width: 236,
          thumbnail_height: 400,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadPinterestMedia('https://www.pinterest.fr/pin/987654321/');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.some((item) => item.url.includes('/originals/'))).toBe(true);
    expect(result.mediaItems?.some((item) => item.url.includes('/236x/'))).toBe(true);
  });

  it('passe par le proxy same-origin si le fetch direct CORS échoue', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) => {
      if (String(input).startsWith('/api/meta-proxy?')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            thumbnail_url: 'https://i.pinimg.com/236x/aa/bb/cc/preview.jpg',
            thumbnail_width: 236,
            thumbnail_height: 400,
          }),
        });
      }
      return Promise.reject(new TypeError('Failed to fetch'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await downloadPinterestMedia('https://www.pinterest.com/pin/123456789012/');
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/meta-proxy?'),
      expect.any(Object)
    );
    expect(result.mediaItems?.some((item) => item.url.includes('pinimg.com'))).toBe(true);
  });
});
