import type { Platform } from './linkDetector';

export const HISTORY_STORAGE_KEY = 'twit.download-history.v1';
export const MAX_HISTORY_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  url: string;
  platform: Platform;
  timestamp: number;
  mediaCount: number;
}

const canUseStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const parseEntries = (raw: string | null): HistoryEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is HistoryEntry => {
      return (
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as HistoryEntry).id === 'string' &&
        typeof (item as HistoryEntry).url === 'string' &&
        typeof (item as HistoryEntry).platform === 'string' &&
        typeof (item as HistoryEntry).timestamp === 'number'
      );
    });
  } catch {
    return [];
  }
};

export const loadHistory = (): HistoryEntry[] => {
  if (!canUseStorage()) return [];
  try {
    return parseEntries(localStorage.getItem(HISTORY_STORAGE_KEY));
  } catch {
    return [];
  }
};

export const saveHistoryEntry = (entry: Omit<HistoryEntry, 'id' | 'timestamp'> & Partial<Pick<HistoryEntry, 'id' | 'timestamp'>>): HistoryEntry[] => {
  const nextEntry: HistoryEntry = {
    id: entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: entry.url.trim(),
    platform: entry.platform,
    timestamp: entry.timestamp ?? Date.now(),
    mediaCount: entry.mediaCount,
  };

  const current = loadHistory().filter((item) => item.url !== nextEntry.url);
  const next = [nextEntry, ...current].slice(0, MAX_HISTORY_ENTRIES);

  if (canUseStorage()) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Mode privé ou quota dépassé : l'historique reste en mémoire pour cette session.
    }
  }

  return next;
};

export const clearHistory = (): void => {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // ignorer
  }
};
