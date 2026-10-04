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

  it('extrait un lien Reddit', () => {
    expect(
      extractInputUrl('voir https://www.reddit.com/r/pics/comments/abc12de/sunset/')
    ).toBe('https://www.reddit.com/r/pics/comments/abc12de/sunset/');
  });

  it('extrait un lien Pinterest', () => {
    expect(extractInputUrl('regarde https://www.pinterest.com/pin/123456789012/')).toBe(
      'https://www.pinterest.com/pin/123456789012/'
    );
  });

  it('extrait un hôte nu pin.it', () => {
    expect(extractInputUrl('pin.it/Ab12CdEf')).toBe('pin.it/Ab12CdEf');
  });

  it('extrait un lien Mastodon', () => {
    expect(extractInputUrl('voir https://mastodon.social/@alice/123456789012345')).toBe(
      'https://mastodon.social/@alice/123456789012345'
    );
  });

  it('extrait un lien Vimeo', () => {
    expect(extractInputUrl('regarde https://vimeo.com/123456789 merci')).toBe(
      'https://vimeo.com/123456789'
    );
  });

  it('extrait un hôte nu player.vimeo.com', () => {
    expect(extractInputUrl('player.vimeo.com/video/987654321')).toBe(
      'player.vimeo.com/video/987654321'
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
