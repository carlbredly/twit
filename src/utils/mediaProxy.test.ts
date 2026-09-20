import { describe, expect, it } from 'vitest';
import {
  isAllowedProxyTarget,
  isProxiedMediaHost,
  resolveMediaFetchUrl,
  MEDIA_PROXY_PATH,
} from './mediaProxy';

describe('mediaProxy helpers', () => {
  it('accepte les hôtes CDN Twitter/X', () => {
    expect(isProxiedMediaHost('video.twimg.com')).toBe(true);
    expect(isProxiedMediaHost('pbs.twimg.com')).toBe(true);
    expect(isProxiedMediaHost('foo.twimg.com')).toBe(true);
    expect(isProxiedMediaHost('example.com')).toBe(false);
  });

  it('valide uniquement les cibles HTTPS twimg', () => {
    expect(isAllowedProxyTarget('https://video.twimg.com/ext_tw_video/1.mp4').ok).toBe(true);
    expect(isAllowedProxyTarget('http://video.twimg.com/ext_tw_video/1.mp4').ok).toBe(false);
    expect(isAllowedProxyTarget('https://evil.com/video.mp4').ok).toBe(false);
    expect(isAllowedProxyTarget('not-a-url').ok).toBe(false);
  });

  it('réécrit les URLs twimg via le proxy en environnement navigateur', () => {
    const source = 'https://video.twimg.com/ext_tw_video/abc/pu/vid/720x1280/x.mp4';
    const resolved = resolveMediaFetchUrl(source);
    expect(resolved.startsWith(`${MEDIA_PROXY_PATH}?url=`)).toBe(true);
    expect(decodeURIComponent(resolved.split('url=')[1])).toBe(source);
  });

  it('laisse passer les URLs non-twimg', () => {
    const source = 'https://cdn.example.com/file.mp4';
    expect(resolveMediaFetchUrl(source)).toBe(source);
  });
});
