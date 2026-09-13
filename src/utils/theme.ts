export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'twit.theme';

export function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

export function toggleTheme(current: Theme): Theme {
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
