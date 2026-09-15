export const MAX_URL_LENGTH = 2048;
export const MAX_MEDIA_BYTES = 150 * 1024 * 1024;
export const MAX_FILENAME_LENGTH = 120;

const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  '0',
  'lvh.me',
  'localtest.me',
  'nip.io',
  'sslip.io',
]);

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.nip.io',
  '.sslip.io',
  '.localtest.me',
];

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
  (p) => p[0] === 100 && p[1] >= 64 && p[1] <= 127,
  (p) => p[0] >= 224,
];

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;
const MEDIA_CONTENT_TYPES = /^(image|video)\//i;
const BLOCKED_CONTENT_TYPES =
  /^(text\/html|text\/javascript|application\/javascript|application\/xhtml\+xml|image\/svg\+xml)/i;

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

export function coerceToHttpUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

export function validatePublicHttpUrl(
  raw: string,
  options?: { httpsOnly?: boolean }
): UrlValidationResult {
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
  if (hasForbiddenCharacters(trimmed) || trimmed.includes('\\')) {
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
  if (parsed.hash && parsed.hash.length > 1) {
    parsed.hash = '';
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, error: 'Hôte non autorisé' };
  }

  return { ok: true, url: parsed };
}

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');

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

  if (/^\d+$/.test(host)) {
    const mapped = decimalToIPv4(Number(host));
    if (mapped && isPrivateOrReservedIPv4(mapped)) {
      return true;
    }
  }

  return false;
}

function decimalToIPv4(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) return null;
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function parseIpv4Octet(part: string): number | null {
  if (!part) return null;
  if (/^0x[0-9a-f]+$/i.test(part)) {
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
  }
  if (/^0[0-7]+$/.test(part)) {
    const value = parseInt(part, 8);
    return value >= 0 && value <= 255 ? value : null;
  }
  if (/^\d+$/.test(part)) {
    const value = Number(part);
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
  }
  return null;
}

function parseIPv4(host: string): number[] | null {
  if (/^\d+$/.test(host)) {
    const mapped = decimalToIPv4(Number(host));
    return mapped ? mapped.split('.').map(Number) : null;
  }

  const parts = host.split('.');
  if (parts.length === 0 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const part of parts) {
    const value = parseIpv4Octet(part);
    if (value === null) return null;
    nums.push(value);
  }

  if (nums.length === 4) return nums;
  if (nums.length === 3) return [nums[0], nums[1], 0, nums[2]];
  if (nums.length === 2) return [nums[0], 0, 0, nums[1]];
  return null;
}

function isPrivateOrReservedIPv4(host: string): boolean {
  const parts = parseIPv4(host);
  if (!parts) return false;
  return PRIVATE_IPV4_RULES.some((rule) => rule(parts));
}

function expandIPv6(host: string): string[] | null {
  const normalized = host.toLowerCase();
  if (!normalized.includes(':')) return null;
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const v4 = normalized.slice(lastColon + 1);
    const v6 = normalized.slice(0, lastColon);
    const parts = parseIPv4(v4);
    if (!parts) return null;
    const hi = ((parts[0] << 8) | parts[1]).toString(16);
    const lo = ((parts[2] << 8) | parts[3]).toString(16);
    return expandIPv6(`${v6}:${hi}:${lo}`);
  }

  const [left, right] = normalized.split('::');
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  if (normalized.includes('::')) {
    const missing = 8 - leftParts.length - rightParts.length;
    if (missing < 0) return null;
    const filled = [...leftParts, ...Array.from({ length: missing }, () => '0'), ...rightParts];
    return filled.length === 8 ? filled : null;
  }
  const parts = normalized.split(':');
  return parts.length === 8 ? parts : null;
}

function isPrivateOrReservedIPv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (!normalized.includes(':')) return false;
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }
  if (normalized.startsWith('ff')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isPrivateOrReservedIPv4(mapped) || isBlockedHost(mapped);
  }

  const parts = expandIPv6(normalized);
  if (!parts) return false;
  const first = Number.parseInt(parts[0] || '0', 16);
  if (first === 0 && parts.slice(1, 7).every((part) => Number.parseInt(part || '0', 16) === 0)) {
    const last = Number.parseInt(parts[7] || '0', 16);
    return last === 0 || last === 1;
  }
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first === 0 && Number.parseInt(parts[5] || '0', 16) === 0xffff) {
    const hi = Number.parseInt(parts[6] || '0', 16);
    const lo = Number.parseInt(parts[7] || '0', 16);
    const mapped = `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    return isPrivateOrReservedIPv4(mapped);
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
    .replace(/[\\/]/g, '-')
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^[.-]+/, '')
    .replace(/[.-]+$/, '')
    .slice(0, MAX_FILENAME_LENGTH);

  if (!cleaned || WINDOWS_RESERVED.test(cleaned)) {
    return 'media';
  }
  return cleaned;
}

export function extensionForMediaType(type: string, contentType?: string): string {
  const mime = contentType?.toLowerCase() ?? '';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4')) return 'mp4';

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

export function isAllowedMediaContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const value = contentType.split(';')[0].trim();
  if (BLOCKED_CONTENT_TYPES.test(value)) return false;
  return MEDIA_CONTENT_TYPES.test(value) || value === 'application/octet-stream';
}

export function parseContentLength(header: string | null): number | null {
  if (!header) return null;
  const value = Number(header);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}
