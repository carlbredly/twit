import { describe, expect, it } from 'vitest';
import {
  addHistoryEntry,
  clearHistory,
  exportHistoryCsv,
  exportHistoryJson,
  filterHistoryEntries,
  HISTORY_STORAGE_KEY,
  importHistoryJson,
  loadHistory,
  removeHistoryEntry,
  sortHistoryEntries,
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

  it('accepte un post Bluesky public', () => {
    const url = 'https://bsky.app/profile/alice.bsky.social/post/3k2abcdef';
    addHistoryEntry(url, 'bluesky', 1);
    expect(loadHistory()[0].platform).toBe('bluesky');
  });

  it('accepte un pin Pinterest public', () => {
    const url = 'https://www.pinterest.com/pin/123456789012/';
    addHistoryEntry(url, 'pinterest', 1);
    expect(loadHistory()[0].platform).toBe('pinterest');
    expect(loadHistory()[0].url).toBe(url);
  });

  it('refuse YouTube dans l’historique', () => {
    addHistoryEntry('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'unknown');
    expect(loadHistory()).toHaveLength(0);
  });

  it('filtre l’historique', () => {
    addHistoryEntry(SAFE_URL, 'instagram');
    addHistoryEntry(TIKTOK_URL, 'tiktok');
    expect(filterHistoryEntries(loadHistory(), 'tiktok')).toHaveLength(1);
    expect(filterHistoryEntries(loadHistory(), 'instagram.com')).toHaveLength(1);
    expect(filterHistoryEntries(loadHistory(), '', { platform: 'tiktok' })).toHaveLength(1);
    expect(
      filterHistoryEntries(loadHistory(), '', {
        favoritesOnly: true,
        favoriteUrls: [TIKTOK_URL],
      })
    ).toHaveLength(1);
  });

  it('place les favoris en tête', () => {
    addHistoryEntry(SAFE_URL, 'instagram');
    addHistoryEntry(TIKTOK_URL, 'tiktok');
    const sorted = sortHistoryEntries(loadHistory(), [SAFE_URL]);
    expect(sorted[0].url).toBe(SAFE_URL);
  });

  it('accepte un statut Mastodon public', () => {
    const url = 'https://mastodon.social/@alice/123456789012345';
    addHistoryEntry(url, 'mastodon', 1);
    expect(loadHistory()[0].platform).toBe('mastodon');
  });

  it('déduplique après suppression du tracking', () => {
    addHistoryEntry(`${SAFE_URL}?utm_source=share`, 'instagram');
    addHistoryEntry(SAFE_URL, 'instagram');
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].url).toBe(SAFE_URL);
  });

  it('exporte un CSV avec en-tête', () => {
    addHistoryEntry(SAFE_URL, 'instagram', 2);
    const csv = exportHistoryCsv();
    expect(csv.split('\n')[0]).toBe('url,platform,createdAt,mediaCount');
    expect(csv).toContain(SAFE_URL);
    expect(csv).toContain('instagram');
  });
});
