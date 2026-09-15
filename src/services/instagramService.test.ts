import { describe, expect, it } from 'vitest';
import { downloadInstagramMedia } from './instagramService';

describe('downloadInstagramMedia', () => {
  it('refuse un profil', async () => {
    const result = await downloadInstagramMedia('https://www.instagram.com/someone/');
    expect(result.success).toBe(false);
  });

  it('refuse une URL privée', async () => {
    const result = await downloadInstagramMedia('http://127.0.0.1/p/abc');
    expect(result.success).toBe(false);
  });
});
