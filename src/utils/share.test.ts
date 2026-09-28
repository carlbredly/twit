import { describe, expect, it } from 'vitest';
import { buildShareUrl } from './share';

describe('buildShareUrl', () => {
  it('construit un lien ?url= pour un média valide', () => {
    const share = buildShareUrl(
      'https://app.example/twit',
      'https://www.instagram.com/p/AbC123/?igsh=xyz'
    );
    expect(share).toBe('https://app.example/twit?url=https%3A%2F%2Fwww.instagram.com%2Fp%2FAbC123%2F');
  });

  it('refuse javascript:', () => {
    expect(buildShareUrl('https://app.example/', 'javascript:alert(1)')).toBeNull();
  });

  it('refuse YouTube', () => {
    expect(buildShareUrl('https://app.example/', 'https://youtu.be/abc')).toBeNull();
  });
});
