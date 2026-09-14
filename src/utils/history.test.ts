import { describe, expect, it } from 'vitest';
import {
  addHistoryEntry,
  clearHistory,
  exportHistoryJson,
  HISTORY_STORAGE_KEY,
  loadHistory,
  removeHistoryEntry,
} from './history';

const SAFE_URL = 'https://www.instagram.com/p/AbC123xyz/';

describe('history', () => {
  it('ajoute et déduplique une entrée', () => {
    addHistoryEntry(SAFE_URL, 'instagram', 2);
    addHistoryEntry(SAFE_URL, 'instagram', 3);
    const items = loadHistory();
    expect(items).toHaveLength(1);
    expect(items[0].mediaCount).toBe(3);
    expect(items[0].platform).toBe('instagram');
  });

  it('ignore une URL dangereuse', () => {
    addHistoryEntry('javascript:alert(1)', 'unknown');
    expect(loadHistory()).toHaveLength(0);
  });

  it('ignore un lookalike au chargement', () => {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        {
          id: '1',
          url: 'https://evilinstagram.com/p/abc',
          platform: 'instagram',
          createdAt: Date.now(),
        },
      ])
    );
    expect(loadHistory()).toHaveLength(0);
  });

  it('supprime une entrée et vide l’historique', () => {
    const [entry] = addHistoryEntry(SAFE_URL, 'instagram');
    expect(removeHistoryEntry(entry.id)).toHaveLength(0);
    addHistoryEntry(SAFE_URL, 'instagram');
    expect(clearHistory()).toHaveLength(0);
  });

  it('exporte un JSON sans identifiants internes', () => {
    addHistoryEntry(SAFE_URL, 'instagram', 1);
    const exported = JSON.parse(exportHistoryJson()) as Array<Record<string, unknown>>;
    expect(exported[0].url).toBe(SAFE_URL);
    expect(exported[0].id).toBeUndefined();
  });
});
