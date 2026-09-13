import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadMedia, filterSafeMediaItems, triggerDownload } from './downloadService';

vi.mock('./instagramService', () => ({
  downloadInstagramMedia: vi.fn(async () => ({
    success: true,
    mediaItems: [{ url: 'https://cdn.example.com/ig.mp4', type: 'video' as const }],
  })),
}));

vi.mock('./twitterService', () => ({
  downloadTwitterMedia: vi.fn(async () => ({
    success: true,
    mediaItems: [
      { url: 'https://cdn.example.com/tw.jpg', type: 'image' as const },
      { url: 'javascript:alert(1)', type: 'image' as const },
    ],
  })),
}));

vi.mock('./snapchatService', () => ({
  downloadSnapchatMedia: vi.fn(async () => ({ success: false, error: 'privé' })),
}));

vi.mock('./tiktokService', () => ({
  downloadTikTokMedia: vi.fn(async () => ({
    success: true,
    mediaItems: [{ url: 'https://cdn.example.com/tt.mp4', type: 'video' as const }],
  })),
}));

describe('filterSafeMediaItems', () => {
  it('écarte les URLs non HTTPS ou internes', () => {
    const filtered = filterSafeMediaItems([
      { url: 'https://cdn.example.com/ok.mp4', type: 'video' },
      { url: 'http://cdn.example.com/insecure.mp4', type: 'video' },
      { url: 'https://127.0.0.1/secret.mp4', type: 'video' },
      { url: 'javascript:alert(1)', type: 'image' },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].url).toContain('cdn.example.com');
  });
});

describe('downloadMedia', () => {
  it('route Instagram, Twitter et TikTok', async () => {
    const ig = await downloadMedia('https://instagram.com/p/abc', 'instagram');
    expect(ig.success).toBe(true);
    expect(ig.mediaItems?.[0].url).toMatch(/ig\.mp4/);

    const tw = await downloadMedia('https://x.com/a/status/1', 'twitter');
    expect(tw.success).toBe(true);
    expect(tw.mediaItems).toHaveLength(1);

    const tt = await downloadMedia('https://www.tiktok.com/@a/video/1', 'tiktok');
    expect(tt.success).toBe(true);
  });

  it('refuse YouTube et les plateformes inconnues', async () => {
    const yt = await downloadMedia('https://youtube.com/watch?v=1', 'youtube');
    expect(yt.success).toBe(false);
    expect(yt.error).toMatch(/YouTube/);

    const unknown = await downloadMedia('https://example.com', 'unknown');
    expect(unknown.success).toBe(false);
  });
});

describe('triggerDownload — sécurité', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('refuse une URL javascript', async () => {
    await expect(triggerDownload('javascript:alert(1)', 'x', 'video')).rejects.toThrow();
  });

  it('refuse une cible SSRF', async () => {
    await expect(triggerDownload('http://169.254.169.254/latest/meta-data', 'x', 'video')).rejects.toThrow();
  });

  it('refuse un type HTML déguisé en média', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html>nope</html>', {
          status: 200,
          headers: { 'content-type': 'text/html', 'content-length': '18' },
        })
      )
    );

    await expect(triggerDownload('https://cdn.example.com/trap', 'x', 'video')).rejects.toThrow(
      /non autorisé/
    );
  });

  it('télécharge un blob média légitime', async () => {
    const click = vi.fn();
    const append = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const remove = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      return { href: '', download: '', rel: '', click } as unknown as HTMLAnchorElement;
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:https://local/test');
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

    await triggerDownload('https://cdn.example.com/ok.mp4', 'clip../name', 'video');
    expect(click).toHaveBeenCalled();
    append.mockRestore();
    remove.mockRestore();
  });
});
