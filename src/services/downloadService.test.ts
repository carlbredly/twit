import { describe, expect, it, vi, afterEach } from 'vitest';
import { triggerDownload, downloadMedia } from './downloadService';

describe('triggerDownload (ssstwitter-style native download)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
});

describe('downloadMedia routing', () => {
  it('rejette les plateformes inconnues', async () => {
    const result = await downloadMedia('https://example.com', 'unknown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/non supportée/i);
  });
});
