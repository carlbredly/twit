import { detectPlatform, type Platform } from './linkDetector';
import { validatePublicHttpUrl } from './security';

export interface HistoryEntry {
  id: string;
  url: string;
  platform: Platform;
  createdAt: number;
  mediaCount?: number;
}

export const HISTORY_STORAGE_KEY = 'twit.download.history.v1';
export const MAX_HISTORY_ITEMS = 20;

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.url === 'string' &&
    typeof entry.platform === 'string' &&
    typeof entry.createdAt === 'number'
  );
}

function looksLikeHistoryPayload(value: unknown): value is { url: string; platform?: string; createdAt?: number; mediaCount?: number; id?: string } {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.url === 'string';
}

export function loadHistory(): HistoryEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isHistoryEntry)
      .map(sanitizeHistoryEntry)
      .filter((entry): entry is HistoryEntry => entry !== null)
      .slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

function sanitizeHistoryEntry(entry: HistoryEntry): HistoryEntry | null {
  const validation = validatePublicHttpUrl(entry.url);
  if (!validation.ok) return null;

  const info = detectPlatform(validation.url.href);
  if (!info.isValid || info.platform === 'unknown') return null;

  return {
    id: entry.id.slice(0, 80),
    url: info.canonicalUrl ?? validation.url.href,
    platform: info.platform,
    createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
    mediaCount:
      typeof entry.mediaCount === 'number' && entry.mediaCount >= 0
        ? Math.min(entry.mediaCount, 50)
        : undefined,
  };
}

export function saveHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const cleaned = entries
    .map(sanitizeHistoryEntry)
    .filter((entry): entry is HistoryEntry => entry !== null)
    .filter((entry) => {
      if (seen.has(entry.url)) return false;
      seen.add(entry.url);
      return true;
    })
    .slice(0, MAX_HISTORY_ITEMS);

  if (canUseStorage()) {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(cleaned));
  }
  return cleaned;
}

export function addHistoryEntry(
  url: string,
  platform: Platform,
  mediaCount?: number
): HistoryEntry[] {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) return loadHistory();

  const current = loadHistory().filter((item) => item.url !== validation.url.href);
  const next: HistoryEntry[] = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: validation.url.href,
      platform,
      createdAt: Date.now(),
      mediaCount,
    },
    ...current,
  ];
  return saveHistory(next);
}

export function removeHistoryEntry(id: string): HistoryEntry[] {
  return saveHistory(loadHistory().filter((entry) => entry.id !== id));
}

export function clearHistory(): HistoryEntry[] {
  if (canUseStorage()) {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }
  return [];
}

export function exportHistoryJson(entries: HistoryEntry[] = loadHistory()): string {
  return JSON.stringify(
    entries.map((entry) => ({
      url: entry.url,
      platform: entry.platform,
      createdAt: entry.createdAt,
      mediaCount: entry.mediaCount,
    })),
    null,
    2
  );
}

export function importHistoryJson(raw: string): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return loadHistory();

    const incoming = parsed
      .filter(looksLikeHistoryPayload)
      .map((entry, index) => ({
        id: typeof entry.id === 'string' ? entry.id : `import-${index}-${Date.now()}`,
        url: entry.url,
        platform: (typeof entry.platform === 'string' ? entry.platform : 'unknown') as Platform,
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now() - index,
        mediaCount: typeof entry.mediaCount === 'number' ? entry.mediaCount : undefined,
      }))
      .map(sanitizeHistoryEntry)
      .filter((entry): entry is HistoryEntry => entry !== null);

    const existing = loadHistory();
    const merged: HistoryEntry[] = [];
    const seen = new Set<string>();

    for (const entry of [...incoming, ...existing]) {
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      merged.push(entry);
    }

    return saveHistory(merged);
  } catch {
    return loadHistory();
  }
}

export function filterHistoryEntries(entries: HistoryEntry[], query: string): HistoryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter(
    (entry) =>
      entry.url.toLowerCase().includes(needle) || entry.platform.toLowerCase().includes(needle)
  );
}
