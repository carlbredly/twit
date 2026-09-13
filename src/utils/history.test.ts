import { beforeEach, describe, expect, it } from 'vitest';
import {
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ENTRIES,
  clearHistory,
  loadHistory,
  saveHistoryEntry,
} from './history';

describe('historique local', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retourne une liste vide sans stockage', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('enregistre et déduplique par URL', () => {
    saveHistoryEntry({ url: 'https://x.com/a/status/1', platform: 'twitter', mediaCount: 1 });
    saveHistoryEntry({ url: 'https://x.com/a/status/1', platform: 'twitter', mediaCount: 2 });

    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].mediaCount).toBe(2);
  });

  it('limite le nombre d’entrées', () => {
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 5; i += 1) {
      saveHistoryEntry({ url: `https://x.com/a/status/${i}`, platform: 'twitter', mediaCount: 1 });
    }
    expect(loadHistory()).toHaveLength(MAX_HISTORY_ENTRIES);
  });

  it('ignore un JSON corrompu', () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, '{not-json');
    expect(loadHistory()).toEqual([]);
  });

  it('vide l’historique', () => {
    saveHistoryEntry({ url: 'https://x.com/a/status/1', platform: 'twitter', mediaCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
