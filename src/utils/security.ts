export const MAX_URL_LENGTH = 2048;
export const MAX_MEDIA_BYTES = 150 * 1024 * 1024;
export const MAX_FILENAME_LENGTH = 120;

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
]);

const BLOCKED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home'];

const PRIVATE_IPV4_RULES: Array<(parts: number[]) => boolean> = [
  (p) => p[0] === 0,
  (p) => p[0] === 10,
  (p) => p[0] === 127,
  (p) => p[0] === 169 && p[1] === 254,
  (p) => p[0] === 172 && p[1] >= 16 && p[1] <= 31,
  (p) => p[0] === 192 && p[1] === 168,
  (p) => p[0] === 192 && p[1] === 0 && p[2] === 2,
  (p) => p[0] === 198 && p[1] === 51 && p[2] === 100,
  (p) => p[0] === 203 && p[1] === 0 && p[2] === 113,
  (p) => p[0] >= 224,
];

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; error: string };

function hasForbiddenCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

export function validatePublicHttpUrl(raw: string, options?: { httpsOnly?: boolean }): UrlValidationResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'URL invalide' };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'URL vide' };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: 'URL trop longue' };
  }
  if (hasForbiddenCharacters(trimmed)) {
    return { ok: false, error: 'Caractères interdits dans l’URL' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: 'URL invalide' };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, error: 'Protocole non autorisé' };
  }
  if (options?.httpsOnly && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Seules les URL HTTPS sont acceptées' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Identifiants dans l’URL interdits' };
  }
  if (!parsed.hostname) {
    return { ok: false, error: 'Hôte manquant' };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, error: 'Hôte non autorisé' };
  }

  return { ok: true, url: parsed };
}

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return true;
  }
  if (host.includes('metadata.google')) {
    return true;
  }

  if (isPrivateOrReservedIPv4(host) || isPrivateOrReservedIPv6(host)) {
    return true;
  }

  const decimalHost = Number(host);
  if (Number.isInteger(decimalHost) && decimalHost >= 0) {
    const mapped = decimalToIPv4(decimalHost);
    if (mapped && isPrivateOrReservedIPv4(mapped)) {
      return true;
    }
  }

  return false;
}

function decimalToIPv4(value: number): string | null {
  if (value > 0xffffffff) return null;
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function parseIPv4(host: string): number[] | null {
  const octalOrHex = /^(0[0-7]+|0x[0-9a-f]+)$/i;
  const parts = host.split('.');
  if (parts.length !== 4) return null;

  const nums: number[] = [];
  for (const part of parts) {
    if (!part || /[^0-9a-fx]/i.test(part)) return null;
    let value: number;
    if (octalOrHex.test(part)) {
      value = Number(part);
    } else if (/^\d+$/.test(part)) {
      value = Number(part);
    } else {
      return null;
    }
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    nums.push(value);
  }
  return nums;
}

function isPrivateOrReservedIPv4(host: string): boolean {
  const parts = parseIPv4(host);
  if (!parts) return false;
  return PRIVATE_IPV4_RULES.some((rule) => rule(parts));
}

function isPrivateOrReservedIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (!normalized.includes(':')) return false;
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isPrivateOrReservedIPv4(mapped) || isBlockedHost(mapped);
  }
  return false;
}

export function hostnameMatches(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^[.-]+/, '')
    .replace(/[.-]+$/, '')
    .slice(0, MAX_FILENAME_LENGTH);

  return cleaned || 'media';
}

export function extensionForMediaType(type: string, contentType?: string): string {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('webp')) return 'webp';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('webm')) return 'webm';
  if (contentType?.includes('mp4')) return 'mp4';

  switch (type) {
    case 'video':
      return 'mp4';
    case 'gif':
      return 'gif';
    case 'image':
      return 'jpg';
    default:
      return 'bin';
  }
}

const MEDIA_CONTENT_TYPES = /^(image|video)\//i;

export function isAllowedMediaContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const value = contentType.split(';')[0].trim();
  return MEDIA_CONTENT_TYPES.test(value) || value === 'application/octet-stream';
}

export function parseContentLength(header: string | null): number | null {
  if (!header) return null;
  const value = Number(header);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
