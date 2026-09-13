/** Limite de taille pour un téléchargement de média (250 Mo). */
export const MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024;

/** Nombre maximum de médias acceptés pour une même requête. */
export const MAX_MEDIA_ITEMS = 30;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
]);

const PRIVATE_IPV4_RULES: Array<(octets: number[]) => boolean> = [
  ([a]) => a === 0,
  ([a]) => a === 10,
  ([a]) => a === 127,
  ([a, b]) => a === 169 && b === 254,
  ([a, b]) => a === 172 && b >= 16 && b <= 31,
  ([a, b]) => a === 192 && b === 168,
  ([a, b]) => a === 100 && b >= 64 && b <= 127,
];

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
  parsed?: URL;
}

const isIPv4 = (hostname: string): number[] | null => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return null;
  return octets;
};

const isBlockedHostname = (hostname: string): boolean => {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (BLOCKED_HOSTS.has(host)) return true;
  if (
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan')
  ) {
    return true;
  }

  const octets = isIPv4(host);
  if (octets && PRIVATE_IPV4_RULES.some((rule) => rule(octets))) {
    return true;
  }

  if (
    host === '::1' ||
    host === '::' ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    host.startsWith('::ffff:127.') ||
    host.startsWith('::ffff:10.') ||
    host.startsWith('::ffff:192.168.') ||
    host.startsWith('::ffff:169.254.')
  ) {
    return true;
  }

  return false;
};

/**
 * Vérifie qu'une URL est un lien http(s) public, sans identifiants ni cibles internes.
 * Protège contre XSS (javascript:/data:), SSRF (localhost, IP privées, metadata) et file://.
 */
export const inspectUrlSafety = (rawUrl: string): UrlSafetyResult => {
  if (typeof rawUrl !== 'string' || rawUrl.trim() === '') {
    return { safe: false, reason: 'URL vide' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return { safe: false, reason: 'URL trop longue' };
  }

  if ([...trimmed].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  })) {
    return { safe: false, reason: 'Caractères de contrôle interdits' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'URL malformée' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { safe: false, reason: `Protocole interdit: ${parsed.protocol}` };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'Identifiants dans l’URL interdits' };
  }

  if (!parsed.hostname) {
    return { safe: false, reason: 'Hôte manquant' };
  }

  if (isBlockedHostname(parsed.hostname)) {
    return { safe: false, reason: 'Hôte interne ou privé interdit' };
  }

  return { safe: true, parsed };
};

export const isSafeHttpUrl = (rawUrl: string): boolean => inspectUrlSafety(rawUrl).safe;

/** Les médias extraits doivent être en HTTPS pour éviter le mixed content et les relais opaques. */
export const isSafeMediaUrl = (rawUrl: string): boolean => {
  const result = inspectUrlSafety(rawUrl);
  return Boolean(result.safe && result.parsed?.protocol === 'https:');
};

export const assertSafeMediaUrl = (rawUrl: string): URL => {
  const result = inspectUrlSafety(rawUrl);
  if (!result.safe || !result.parsed) {
    throw new Error(result.reason || 'URL média non sûre');
  }
  if (result.parsed.protocol !== 'https:') {
    throw new Error('Seules les URLs HTTPS sont acceptées pour le téléchargement');
  }
  return result.parsed;
};

/**
 * Neutralise les caractères de traversée de chemin et les noms réservés Windows.
 */
export const sanitizeFilename = (name: string): string => {
  const base = [...(name || 'media')]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code <= 31 || '<>:"/\\|?*'.includes(char)) return '_';
      return char;
    })
    .join('')
    .replace(/^\.+/, '_')
    .replace(/\.\./g, '_')
    .replace(/\s+/g, '-')
    .slice(0, 180)
    .replace(/[. ]+$/, '');

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  const cleaned = base || 'media';
  return reserved.test(cleaned) ? `file-${cleaned}` : cleaned;
};

export const isAllowedMediaContentType = (contentType: string | null): boolean => {
  if (!contentType) return false;
  const type = contentType.split(';')[0].trim().toLowerCase();
  return (
    type.startsWith('image/') ||
    type.startsWith('video/') ||
    type === 'application/octet-stream' ||
    type === 'application/mp4'
  );
};

export const normalizeInputUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};
