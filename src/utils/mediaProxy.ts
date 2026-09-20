/** Hosts that often block browser CORS fetches (esp. video.twimg.com → 403). */
const PROXIED_MEDIA_HOSTS = new Set([
  'video.twimg.com',
  'pbs.twimg.com',
  'ton.twimg.com',
  'abs.twimg.com',
  'amplify.twimg.com',
]);

export const MEDIA_PROXY_PATH = '/api/media-proxy';

export const isProxiedMediaHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  if (PROXIED_MEDIA_HOSTS.has(host)) return true;
  return host.endsWith('.twimg.com');
};

export const isAllowedProxyTarget = (
  rawUrl: string
): { ok: true; url: URL } | { ok: false; error: string } => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'URL média invalide' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Seules les URLs HTTPS sont autorisées' };
  }

  if (!isProxiedMediaHost(parsed.hostname)) {
    return { ok: false, error: 'Hôte média non autorisé pour le proxy' };
  }

  return { ok: true, url: parsed };
};

/**
 * Route Twitter/X CDN URLs through the same-origin Vite proxy so the browser
 * does not send cross-origin CORS headers that trigger CDN 403 responses.
 */
export const resolveMediaFetchUrl = (mediaUrl: string): string => {
  const allowed = isAllowedProxyTarget(mediaUrl);
  if (!allowed.ok) {
    return mediaUrl;
  }

  return `${MEDIA_PROXY_PATH}?url=${encodeURIComponent(allowed.url.href)}`;
};
