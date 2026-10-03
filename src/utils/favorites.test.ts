import { describe, expect, it } from 'vitest';
import {
  clearFavorites,
  FAVORITES_STORAGE_KEY,
  isFavorite,
  loadFavoriteUrls,
  toggleFavorite,
} from './favorites';

const SAFE_URL = 'https://mastodon.social/@alice/123456789012345';
const TRACKED = `${SAFE_URL}?utm_source=share`;
const OTHER = 'https://www.instagram.com/p/AbC123xyz/';

describe('favorites', () => {
  it('ajoute et retire un favori', () => {
    expect(toggleFavorite(SAFE_URL)).toEqual([SAFE_URL]);
    expect(isFavorite(SAFE_URL)).toBe(true);
    expect(toggleFavorite(SAFE_URL)).toEqual([]);
    expect(isFavorite(SAFE_URL)).toBe(false);
  });

  it('ignore javascript: et les lookalikes', () => {
    expect(toggleFavorite('javascript:alert(1)')).toEqual([]);
    expect(toggleFavorite('https://evilmastodon.social/@alice/123456789012345')).toEqual([]);
    expect(loadFavoriteUrls()).toHaveLength(0);
  });

  it('déduplique après suppression du tracking', () => {
    toggleFavorite(TRACKED);
    toggleFavorite(SAFE_URL);
    expect(loadFavoriteUrls()).toEqual([SAFE_URL]);
  });

  it('filtre les favoris dangereux déjà stockés', () => {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(['javascript:alert(1)', 'https://evilinstagram.com/p/abc', OTHER])
    );
    expect(loadFavoriteUrls()).toEqual([OTHER]);
  });

  it('vide les favoris', () => {
    toggleFavorite(SAFE_URL);
    expect(clearFavorites()).toEqual([]);
    expect(loadFavoriteUrls()).toHaveLength(0);
  });
});
