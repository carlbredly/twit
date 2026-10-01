export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'twit.theme';

function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function readStoredTheme(): Theme {
  if (typeof localStorage !== 'undefined') {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'dark' || value === 'light') return value;
  }
  return prefersDark() ? 'dark' : 'light';
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
