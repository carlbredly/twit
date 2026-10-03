import { hostnameMatches, validatePublicHttpUrl } from './security';

export const META_PROXY_PATH = '/api/meta-proxy';

const META_RULES = [
  { hosts: ['pinterest.com'] as const, pathPrefix: '/oembed.json' },
  { hosts: ['api.pinterest.com'] as const, pathPrefix: '/v3/pidgets/pins/info/' },
] as const;

export function isAllowedMetaTarget(
  rawUrl: string
): { ok: true; url: URL } | { ok: false; error: string } {
  const validation = validatePublicHttpUrl(rawUrl, { httpsOnly: true });
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  if (validation.url.port && validation.url.port !== '443') {
    return { ok: false, error: 'Port non autorisé pour le proxy' };
  }

  const allowed = META_RULES.some(
    (rule) =>
      hostnameMatches(validation.url.hostname, rule.hosts) &&
      validation.url.pathname.startsWith(rule.pathPrefix)
  );

  if (!allowed) {
    return { ok: false, error: 'Hôte ou chemin non autorisé pour le proxy métadonnées' };
  }

  return { ok: true, url: validation.url };
}

export function buildMetaProxyUrl(targetUrl: string): string | null {
  const allowed = isAllowedMetaTarget(targetUrl);
  if (!allowed.ok) return null;
  const params = new URLSearchParams();
  params.set('url', allowed.url.href);
  return `${META_PROXY_PATH}?${params.toString()}`;
}

/** Same-origin JSON fetch for the metadata proxy (relative path only). */
export async function fetchViaMetaProxy(
  targetUrl: string,
  signal?: AbortSignal
): Promise<unknown | null> {
  const href = buildMetaProxyUrl(targetUrl);
  if (!href || !href.startsWith(`${META_PROXY_PATH}?`)) return null;

  try {
    const response = await fetch(href, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
