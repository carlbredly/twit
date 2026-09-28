import { describe, expect, it } from 'vitest';
import {
  addHistoryEntry,
  clearHistory,
  exportHistoryJson,
  filterHistoryEntries,
  HISTORY_STORAGE_KEY,
  importHistoryJson,
  loadHistory,
  removeHistoryEntry,
} from './history';

const SAFE_URL = 'https://www.instagram.com/p/AbC123xyz/';
const TIKTOK_URL = 'https://www.tiktok.com/@user/video/7123456789012345678';

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

  it('importe un JSON et ignore les URL dangereuses', () => {
    const raw = JSON.stringify([
      { url: TIKTOK_URL, platform: 'tiktok', createdAt: 1 },
      { url: 'javascript:alert(1)', platform: 'unknown', createdAt: 2 },
      { url: 'https://evilinstagram.com/p/abc', platform: 'instagram', createdAt: 3 },
    ]);
    const imported = importHistoryJson(raw);
    expect(imported).toHaveLength(1);
    expect(imported[0].platform).toBe('tiktok');
  });

  it('filtre l’historique', () => {
    addHistoryEntry(SAFE_URL, 'instagram');
    addHistoryEntry(TIKTOK_URL, 'tiktok');
    expect(filterHistoryEntries(loadHistory(), 'tiktok')).toHaveLength(1);
    expect(filterHistoryEntries(loadHistory(), 'instagram.com')).toHaveLength(1);
  });

  it('déduplique après suppression du tracking', () => {
    addHistoryEntry(`${SAFE_URL}?utm_source=share`, 'instagram');
    addHistoryEntry(SAFE_URL, 'instagram');
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].url).toBe(SAFE_URL);
  });
});
