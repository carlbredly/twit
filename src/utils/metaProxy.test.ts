import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  META_PROXY_PATH,
  buildMetaProxyUrl,
  fetchViaMetaProxy,
  isAllowedMetaTarget,
} from './metaProxy';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isAllowedMetaTarget', () => {
  it('accepte oEmbed Pinterest HTTPS', () => {
    const result = isAllowedMetaTarget(
      'https://www.pinterest.com/oembed.json?url=https://www.pinterest.com/pin/1/'
    );
    expect(result.ok).toBe(true);
  });

  it('accepte pidgets Pinterest', () => {
    expect(isAllowedMetaTarget('https://api.pinterest.com/v3/pidgets/pins/info/?pin_ids=1').ok).toBe(
      true
    );
  });

  it('refuse un hôte tiers', () => {
    expect(isAllowedMetaTarget('https://evil.com/oembed.json').ok).toBe(false);
  });

  it('refuse un lookalike pinterest', () => {
    expect(isAllowedMetaTarget('https://evilpinterest.com/oembed.json').ok).toBe(false);
    expect(isAllowedMetaTarget('https://pinterest.com.evil.com/oembed.json').ok).toBe(false);
  });

  it('refuse un chemin Pinterest hors allowlist', () => {
    expect(isAllowedMetaTarget('https://www.pinterest.com/pin/123/').ok).toBe(false);
    expect(isAllowedMetaTarget('https://api.pinterest.com/v3/users/me/').ok).toBe(false);
  });

  it('refuse javascript:, ports et identifiants', () => {
    expect(isAllowedMetaTarget('javascript:alert(1)').ok).toBe(false);
    expect(isAllowedMetaTarget('https://www.pinterest.com:8443/oembed.json').ok).toBe(false);
    expect(isAllowedMetaTarget('https://user:pass@www.pinterest.com/oembed.json').ok).toBe(false);
  });

  it('refuse une IP privée', () => {
    expect(isAllowedMetaTarget('https://127.0.0.1/oembed.json').ok).toBe(false);
  });
});

describe('buildMetaProxyUrl', () => {
  it('construit un chemin same-origin', () => {
    const source = 'https://www.pinterest.com/oembed.json?url=https://www.pinterest.com/pin/1/';
    const built = buildMetaProxyUrl(source);
    expect(built?.startsWith(`${META_PROXY_PATH}?`)).toBe(true);
    const params = new URL(built ?? '', 'http://localhost').searchParams;
    expect(params.get('url')).toBe(source);
  });

  it('retourne null pour une cible interdite', () => {
    expect(buildMetaProxyUrl('https://evil.com/x')).toBeNull();
  });
});

describe('fetchViaMetaProxy', () => {
  it('n’appelle fetch que pour une cible autorisée', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await fetchViaMetaProxy('https://evil.com/oembed.json')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lit le JSON same-origin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ thumbnail_url: 'https://i.pinimg.com/ok.jpg' }),
      })
    );
    const data = await fetchViaMetaProxy(
      'https://www.pinterest.com/oembed.json?url=https://www.pinterest.com/pin/1/'
    );
    expect(data).toEqual({ thumbnail_url: 'https://i.pinimg.com/ok.jpg' });
  });
});
