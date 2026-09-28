import { describe, expect, it } from 'vitest';
import { readUrlQueryParam } from './query';

describe('readUrlQueryParam', () => {
  it('accepte un lien social valide', () => {
    const url = readUrlQueryParam('?url=https%3A%2F%2Fwww.instagram.com%2Fp%2FAbC123%2F');
    expect(url).toBe('https://www.instagram.com/p/AbC123/');
  });

  it('refuse javascript:', () => {
    expect(readUrlQueryParam('?url=javascript:alert(1)')).toBeNull();
  });

  it('refuse YouTube', () => {
    expect(readUrlQueryParam('?url=https://youtu.be/abc')).toBeNull();
  });

  it('retourne null sans paramètre', () => {
    expect(readUrlQueryParam('')).toBeNull();
  });
});
