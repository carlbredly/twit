import { detectPlatform } from './linkDetector';
import { validatePublicHttpUrl } from './security';

export const FAVORITES_STORAGE_KEY = 'twit.download.favorites.v1';
export const MAX_FAVORITES = 40;

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function sanitizeFavoriteUrl(raw: string): string | null {
  const validation = validatePublicHttpUrl(raw);
  if (!validation.ok) return null;
  const info = detectPlatform(validation.url.href);
  if (!info.isValid || info.platform === 'unknown') return null;
  return info.canonicalUrl ?? validation.url.href;
}

export function loadFavoriteUrls(): string[] {
  if (!canUseStorage()) return [];

  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string') continue;
      const url = sanitizeFavoriteUrl(item);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      cleaned.push(url);
      if (cleaned.length >= MAX_FAVORITES) break;
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveFavoriteUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of urls) {
    const url = sanitizeFavoriteUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    cleaned.push(url);
    if (cleaned.length >= MAX_FAVORITES) break;
  }

  if (canUseStorage()) {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cleaned));
  }
  return cleaned;
}

export function isFavorite(url: string, favorites: readonly string[] = loadFavoriteUrls()): boolean {
  const sanitized = sanitizeFavoriteUrl(url);
  if (!sanitized) return false;
  return favorites.includes(sanitized);
}

export function toggleFavorite(url: string): string[] {
  const sanitized = sanitizeFavoriteUrl(url);
  if (!sanitized) return loadFavoriteUrls();

  const current = loadFavoriteUrls();
  if (current.includes(sanitized)) {
    return saveFavoriteUrls(current.filter((item) => item !== sanitized));
  }
  return saveFavoriteUrls([sanitized, ...current]);
}

export function clearFavorites(): string[] {
  if (canUseStorage()) {
    localStorage.removeItem(FAVORITES_STORAGE_KEY);
  }
  return [];
}
