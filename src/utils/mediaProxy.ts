import { isBlockedHost, validatePublicHttpUrl } from './security';

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
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (isBlockedHost(host)) return false;
  if (PROXIED_MEDIA_HOSTS.has(host)) return true;
  return host.endsWith('.twimg.com');
};

export const isAllowedProxyTarget = (
  rawUrl: string
): { ok: true; url: URL } | { ok: false; error: string } => {
  const validation = validatePublicHttpUrl(rawUrl, { httpsOnly: true });
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  if (validation.url.port && validation.url.port !== '443') {
    return { ok: false, error: 'Port non autorisé pour le proxy' };
  }

  if (!isProxiedMediaHost(validation.url.hostname)) {
    return { ok: false, error: 'Hôte média non autorisé pour le proxy' };
  }

  return { ok: true, url: validation.url };
};

/**
 * Build a same-origin download URL like ssstwitter → ssscdn:
 * the browser navigates to this URL and receives Content-Disposition: attachment.
 */
export const buildProxiedDownloadUrl = (
  mediaUrl: string,
  filename?: string
): string => {
  const allowed = isAllowedProxyTarget(mediaUrl);
  if (!allowed.ok) {
    return mediaUrl;
  }

  const params = new URLSearchParams();
  params.set('url', allowed.url.href);
  if (filename) {
    params.set('filename', filename);
  }
  return `${MEDIA_PROXY_PATH}?${params.toString()}`;
};

/** @deprecated use buildProxiedDownloadUrl */
export const resolveMediaFetchUrl = (mediaUrl: string): string =>
  buildProxiedDownloadUrl(mediaUrl);
