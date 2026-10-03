import { describe, expect, it } from 'vitest';
import { isCancelHotkey, isSearchHotkey } from './keyboard';

describe('isSearchHotkey', () => {
  it('accepte Ctrl+Entrée', () => {
    expect(isSearchHotkey({ key: 'Enter', ctrlKey: true, metaKey: false })).toBe(true);
  });

  it('accepte ⌘+Entrée', () => {
    expect(isSearchHotkey({ key: 'Enter', ctrlKey: false, metaKey: true })).toBe(true);
  });

  it('refuse Entrée seule', () => {
    expect(isSearchHotkey({ key: 'Enter', ctrlKey: false, metaKey: false })).toBe(false);
  });

  it('refuse Alt+Ctrl+Entrée et les répétitions', () => {
    expect(isSearchHotkey({ key: 'Enter', ctrlKey: true, metaKey: false, altKey: true })).toBe(false);
    expect(isSearchHotkey({ key: 'Enter', ctrlKey: true, metaKey: false, repeat: true })).toBe(false);
  });
});

describe('isCancelHotkey', () => {
  it('accepte Échap', () => {
    expect(isCancelHotkey({ key: 'Escape' })).toBe(true);
  });

  it('refuse les autres touches', () => {
    expect(isCancelHotkey({ key: 'Enter' })).toBe(false);
  });
});
