import { coerceToHttpUrl, validatePublicHttpUrl } from './security';
import { detectPlatform } from './linkDetector';

export function readUrlQueryParam(search: string): string | null {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const value = params.get('url');
  if (!value) return null;

  const validation = validatePublicHttpUrl(coerceToHttpUrl(value));
  if (!validation.ok) return null;

  const info = detectPlatform(validation.url.href);
  return info.isValid ? validation.url.href : null;
}
