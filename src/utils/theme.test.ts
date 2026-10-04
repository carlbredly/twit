import { describe, expect, it } from 'vitest';
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY, toggleTheme } from './theme';

describe('theme', () => {
  it('lit le thème stocké', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('bascule et applique la classe dark', () => {
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    toggleTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
