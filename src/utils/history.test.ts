import { afterEach, describe, expect, it } from 'vitest';
import {
  HISTORY_STORAGE_KEY,
  addHistoryEntry,
  clearHistory,
  loadHistory,
  saveHistory,
} from './history';

afterEach(() => {
  localStorage.clear();
});

describe('history', () => {
  it('enregistre uniquement des URL publiques valides', () => {
    const entries = addHistoryEntry('https://x.com/user/status/42', 'twitter', 1);
    expect(entries).toHaveLength(1);
    expect(entries[0].url).toBe('https://x.com/user/status/42');
    expect(loadHistory()).toHaveLength(1);
  });

  it('ignore une URL dangereuse injectée dans le stockage', () => {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          id: '1',
          url: 'javascript:alert(1)',
          platform: 'twitter',
          createdAt: Date.now(),
        },
        {
          id: '2',
          url: 'https://www.tiktok.com/@u/video/99',
          platform: 'tiktok',
          createdAt: Date.now(),
        },
      ])
    );

    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].platform).toBe('tiktok');
  });

  it('vide l’historique', () => {
    addHistoryEntry('https://x.com/user/status/1', 'twitter');
    expect(clearHistory()).toEqual([]);
    expect(loadHistory()).toEqual([]);
  });

  it('rejette un JSON malformé', () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, '{not-json');
    expect(loadHistory()).toEqual([]);
  });

  it('limite la taille de l’historique', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      id: `${index}`,
      url: `https://x.com/user/status/${index + 1}`,
      platform: 'twitter' as const,
      createdAt: Date.now() + index,
    }));
    expect(saveHistory(many)).toHaveLength(20);
  });
});
