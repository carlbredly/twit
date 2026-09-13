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
    url: validation.url.href,
    platform: info.platform,
    createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
    mediaCount:
      typeof entry.mediaCount === 'number' && entry.mediaCount >= 0
        ? Math.min(entry.mediaCount, 50)
        : undefined,
  };
}

export function saveHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const cleaned = entries
    .map(sanitizeHistoryEntry)
    .filter((entry): entry is HistoryEntry => entry !== null)
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

export function clearHistory(): HistoryEntry[] {
  if (canUseStorage()) {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }
  return [];
}
