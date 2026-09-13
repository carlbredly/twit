import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadMedia, triggerDownload } from './downloadService';

vi.mock('./twitterService', () => ({
  downloadTwitterMedia: vi.fn(async () => ({
    success: true,
    platform: 'twitter',
    mediaItems: [{ url: 'https://video.twimg.com/a.mp4', type: 'video' }],
    mediaType: 'video',
  })),
}));

vi.mock('./instagramService', () => ({
  downloadInstagramMedia: vi.fn(async () => ({ success: false, error: 'ig', platform: 'instagram' })),
}));

vi.mock('./snapchatService', () => ({
  downloadSnapchatMedia: vi.fn(async () => ({ success: false, error: 'snap', platform: 'snapchat' })),
}));

vi.mock('./tiktokService', () => ({
  downloadTikTokMedia: vi.fn(async () => ({
    success: true,
    platform: 'tiktok',
    mediaItems: [{ url: 'https://v16-webapp.tiktok.com/a.mp4', type: 'video' }],
    mediaType: 'video',
  })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('downloadMedia', () => {
  it('refuse une URL non sûre avant d’appeler un service', async () => {
    const result = await downloadMedia('javascript:alert(1)', 'twitter');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('route Twitter et TikTok', async () => {
    const twitter = await downloadMedia('https://x.com/user/status/1', 'twitter');
    const tiktok = await downloadMedia('https://www.tiktok.com/@u/video/1', 'tiktok');
    expect(twitter.success).toBe(true);
    expect(tiktok.success).toBe(true);
    expect(tiktok.platform).toBe('tiktok');
  });

  it('rejette une plateforme inconnue', async () => {
    const result = await downloadMedia('https://example.com/video', 'unknown');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Plateforme non supportée');
  });
});

describe('triggerDownload', () => {
  it('refuse de télécharger une URL interne ou non HTTPS', async () => {
    await expect(triggerDownload('http://127.0.0.1/secret.mp4', 'out', 'video')).rejects.toThrow();
    await expect(triggerDownload('javascript:alert(1)', 'out', 'video')).rejects.toThrow();
  });

  it('refuse un type de contenu HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html>nope</html>', {
          status: 200,
          headers: { 'content-type': 'text/html', 'content-length': '16' },
        })
      )
    );

    await expect(
      triggerDownload('https://cdn.example.com/video.mp4', 'media', 'video')
    ).rejects.toThrow('Type de fichier non autorisé');
  });

  it('télécharge un média autorisé et déclenche un lien', async () => {
    const click = vi.fn();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: {
          get: (name: string) => {
            if (name === 'content-type') return 'video/mp4';
            if (name === 'content-length') return '11';
            return null;
          },
        },
        blob: async () => ({ size: 11, type: 'video/mp4' }),
      }))
    );

    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = createElement(tagName);
      if (tagName === 'a') {
        Object.defineProperty(el, 'click', { value: click });
      }
      return el;
    });

    await triggerDownload('https://cdn.example.com/clip.mp4', '../../evil', 'video');
    expect(click).toHaveBeenCalled();
    const link = document.querySelector('a');
    expect(link).toBeNull();
  });
});
