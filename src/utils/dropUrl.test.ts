import { describe, expect, it } from 'vitest';
import { extractDroppedUrl, extractInputUrl } from './dropUrl';

describe('extractInputUrl', () => {
  it('accepte un lien déjà valide', () => {
    expect(extractInputUrl('https://x.com/user/status/42')).toBe('https://x.com/user/status/42');
  });

  it('extrait un lien au milieu d’un texte', () => {
    expect(
      extractInputUrl('Regarde ça https://www.instagram.com/p/AbC123xyz/ stp')
    ).toBe('https://www.instagram.com/p/AbC123xyz/');
  });

  it('extrait un lien Threads', () => {
    expect(
      extractInputUrl('https://www.threads.net/@alice/post/Dabc123xyz')
    ).toBe('https://www.threads.net/@alice/post/Dabc123xyz');
  });

  it('extrait un lien Bluesky', () => {
    expect(extractInputUrl('voir https://bsky.app/profile/alice.bsky.social/post/3kxyz')).toBe(
      'https://bsky.app/profile/alice.bsky.social/post/3kxyz'
    );
  });

  it('extrait un hôte nu TikTok', () => {
    expect(extractInputUrl('vm.tiktok.com/ZMabcdefg/')).toBe('vm.tiktok.com/ZMabcdefg/');
  });

  it('ignore javascript:', () => {
    expect(extractInputUrl('javascript:alert(1)')).toBeNull();
  });

  it('ignore YouTube', () => {
    expect(extractInputUrl('voir https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });

  it('ignore un texte sans lien', () => {
    expect(extractInputUrl('bonjour')).toBeNull();
  });
});

describe('extractDroppedUrl', () => {
  it('préfère text/uri-list', () => {
    const transfer = {
      getData(type: string) {
        if (type === 'text/uri-list') {
          return '#comment\nhttps://x.com/user/status/99\n';
        }
        return '';
      },
    } as DataTransfer;
    expect(extractDroppedUrl(transfer)).toBe('https://x.com/user/status/99');
  });

  it('utilise text/plain en repli', () => {
    const transfer = {
      getData(type: string) {
        if (type === 'text/plain') return 'voici https://www.tiktok.com/@u/video/1234567890123456789';
        return '';
      },
    } as DataTransfer;
    expect(extractDroppedUrl(transfer)).toBe(
      'https://www.tiktok.com/@u/video/1234567890123456789'
    );
  });
});
