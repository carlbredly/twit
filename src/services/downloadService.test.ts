import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { triggerDownload, downloadMedia } from './downloadService';

describe('triggerDownload', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
    );
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('refuse les réponses HTTP non-OK (ex: 403 Unauthorized du CDN)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Unauthorized.', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    await expect(
      triggerDownload('https://video.twimg.com/ext_tw_video/x.mp4', 'clip', 'video')
    ).rejects.toThrow(/403/);
  });

  it('refuse les blobs trop petits (évite les fichiers 0 Ko)', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('tiny', {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      })
    );

    await expect(
      triggerDownload('https://video.twimg.com/ext_tw_video/x.mp4', 'clip', 'video')
    ).rejects.toThrow(/vide ou trop petit/);
  });

  it('refuse les content-types non média (corps d\'erreur JSON/texte)', async () => {
    const payload = 'x'.repeat(200);
    vi.mocked(fetch).mockResolvedValue(
      new Response(payload, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await expect(
      triggerDownload('https://video.twimg.com/ext_tw_video/x.mp4', 'clip', 'video')
    ).rejects.toThrow(/non média/);
  });

  it('télécharge un média valide et retarde revokeObjectURL', async () => {
    const bytes = new Uint8Array(2048).fill(7);
    vi.mocked(fetch).mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      })
    );

    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          rel: '',
          click,
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    await triggerDownload(
      'https://video.twimg.com/ext_tw_video/x.mp4',
      'clip',
      'video'
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/media-proxy?url='),
      expect.objectContaining({ redirect: 'follow' })
    );
    expect(click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(59_000);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    appendChild.mockRestore();
    removeChild.mockRestore();
  });

  it('utilise l\'extension mp4 pour les GIFs Twitter', async () => {
    const bytes = new Uint8Array(512).fill(1);
    vi.mocked(fetch).mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      })
    );

    let downloadName = '';
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return {
          set href(_v: string) {},
          get href() {
            return '';
          },
          set download(v: string) {
            downloadName = v;
          },
          get download() {
            return downloadName;
          },
          rel: '',
          click: vi.fn(),
        } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n);
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n);

    await triggerDownload('https://video.twimg.com/tweet_video/x.mp4', 'anim', 'gif');
    expect(downloadName).toBe('anim.mp4');
  });
});

describe('downloadMedia routing', () => {
  it('rejette les plateformes inconnues', async () => {
    const result = await downloadMedia('https://example.com', 'unknown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/non supportée/i);
  });
});
