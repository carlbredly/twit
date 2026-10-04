import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  extractBlueskyPostRef,
  extractInstagramShortcode,
  extractMastodonStatusRef,
  extractPinterestPinId,
  extractRedditPostId,
  extractThreadsShortcode,
  extractTikTokVideoId,
  extractTweetId,
  extractVimeoVideoRef,
  getPlatformName,
  isMastodonHost,
  isPinterestHost,
  isVimeoHost,
} from './linkDetector';

describe('detectPlatform', () => {
  it('détecte Instagram via l’hôte réel', () => {
    const info = detectPlatform('https://www.instagram.com/p/AbC123_/');
    expect(info.platform).toBe('instagram');
    expect(info.isValid).toBe(true);
  });

  it('accepte un lien Instagram sans protocole', () => {
    const info = detectPlatform('instagram.com/reel/xyz789');
    expect(info.platform).toBe('instagram');
    expect(info.isValid).toBe(true);
  });

  it('retire les paramètres de tracking du canonique', () => {
    const info = detectPlatform('https://www.instagram.com/p/AbC123/?igsh=xyz&utm_source=share');
    expect(info.isValid).toBe(true);
    expect(info.canonicalUrl).toBe('https://www.instagram.com/p/AbC123/');
  });

  it('refuse un lookalike evilinstagram.com', () => {
    const info = detectPlatform('https://evilinstagram.com/p/abc');
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('refuse instagram.com.evil.com', () => {
    const info = detectPlatform('https://instagram.com.evil.com/p/abc');
    expect(info.isValid).toBe(false);
  });

  it('refuse un profil Instagram', () => {
    const info = detectPlatform('https://www.instagram.com/someuser/');
    expect(info.platform).toBe('instagram');
    expect(info.isValid).toBe(false);
  });

  it('détecte Twitter/X', () => {
    const info = detectPlatform('https://x.com/user/status/1234567890123456789');
    expect(info.platform).toBe('twitter');
    expect(info.isValid).toBe(true);
  });

  it('refuse un profil Twitter', () => {
    const info = detectPlatform('https://twitter.com/someone');
    expect(info.platform).toBe('twitter');
    expect(info.isValid).toBe(false);
  });

  it('détecte Snapchat Spotlight', () => {
    const info = detectPlatform('https://www.snapchat.com/spotlight/W7_abc');
    expect(info.platform).toBe('snapchat');
    expect(info.isValid).toBe(true);
  });

  it('refuse un lien /add Snapchat', () => {
    const info = detectPlatform('https://www.snapchat.com/add/someone');
    expect(info.platform).toBe('snapchat');
    expect(info.isValid).toBe(false);
  });

  it('détecte TikTok vidéo', () => {
    const info = detectPlatform('https://www.tiktok.com/@user/video/7123456789012345678');
    expect(info.platform).toBe('tiktok');
    expect(info.isValid).toBe(true);
  });

  it('détecte un lien court vm.tiktok.com', () => {
    const info = detectPlatform('https://vm.tiktok.com/ZMabcdefg/');
    expect(info.platform).toBe('tiktok');
    expect(info.isValid).toBe(true);
  });

  it('détecte un lien court vt.tiktok.com', () => {
    const info = detectPlatform('https://vt.tiktok.com/ZSabcdef/');
    expect(info.platform).toBe('tiktok');
    expect(info.isValid).toBe(true);
  });

  it('détecte un post Threads', () => {
    const info = detectPlatform('https://www.threads.net/@alice/post/Dabc123xyz');
    expect(info.platform).toBe('threads');
    expect(info.isValid).toBe(true);
  });

  it('détecte un post Bluesky', () => {
    const info = detectPlatform('https://bsky.app/profile/alice.bsky.social/post/3k2abcdef');
    expect(info.platform).toBe('bluesky');
    expect(info.isValid).toBe(true);
  });

  it('refuse un profil Bluesky sans post', () => {
    const info = detectPlatform('https://bsky.app/profile/alice.bsky.social');
    expect(info.platform).toBe('bluesky');
    expect(info.isValid).toBe(false);
  });

  it('refuse un lookalike evilbsky.app', () => {
    const info = detectPlatform('https://evilbsky.app/profile/a/post/abc');
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('détecte un lien court Threads /t/', () => {
    const info = detectPlatform('https://www.threads.com/t/Dabc123xyz');
    expect(info.platform).toBe('threads');
    expect(info.isValid).toBe(true);
  });

  it('refuse un profil Threads', () => {
    const info = detectPlatform('https://www.threads.net/@alice');
    expect(info.platform).toBe('threads');
    expect(info.isValid).toBe(false);
  });

  it('refuse un lookalike threads.net.evil.com', () => {
    const info = detectPlatform('https://threads.net.evil.com/@a/post/abc');
    expect(info.isValid).toBe(false);
  });

  it('détecte un post Reddit', () => {
    const info = detectPlatform('https://www.reddit.com/r/pics/comments/abc12de/sunset/');
    expect(info.platform).toBe('reddit');
    expect(info.isValid).toBe(true);
  });

  it('détecte un lien court redd.it', () => {
    const info = detectPlatform('https://redd.it/abc12de');
    expect(info.platform).toBe('reddit');
    expect(info.isValid).toBe(true);
  });

  it('refuse un subreddit sans post', () => {
    const info = detectPlatform('https://www.reddit.com/r/pics/');
    expect(info.platform).toBe('reddit');
    expect(info.isValid).toBe(false);
  });

  it('refuse un lookalike evilreddit.com', () => {
    const info = detectPlatform('https://evilreddit.com/r/pics/comments/abc12de/x');
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('détecte un pin Pinterest', () => {
    const info = detectPlatform('https://www.pinterest.com/pin/123456789012345678/');
    expect(info.platform).toBe('pinterest');
    expect(info.isValid).toBe(true);
  });

  it('détecte un pin Pinterest localisé', () => {
    const info = detectPlatform('https://www.pinterest.fr/pin/987654321/');
    expect(info.platform).toBe('pinterest');
    expect(info.isValid).toBe(true);
  });

  it('détecte un lien court pin.it', () => {
    const info = detectPlatform('https://pin.it/Ab12CdEf');
    expect(info.platform).toBe('pinterest');
    expect(info.isValid).toBe(true);
  });

  it('refuse un profil Pinterest', () => {
    const info = detectPlatform('https://www.pinterest.com/someone/');
    expect(info.platform).toBe('pinterest');
    expect(info.isValid).toBe(false);
  });

  it('refuse un lookalike evilpinterest.com', () => {
    const info = detectPlatform('https://evilpinterest.com/pin/123');
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('refuse pinterest.com.evil.com', () => {
    const info = detectPlatform('https://pinterest.com.evil.com/pin/123');
    expect(info.isValid).toBe(false);
  });

  it('détecte un statut Mastodon', () => {
    const info = detectPlatform('https://mastodon.social/@alice/123456789012345');
    expect(info.platform).toBe('mastodon');
    expect(info.isValid).toBe(true);
  });

  it('détecte un statut Mastodon /users/…/statuses/…', () => {
    const info = detectPlatform('https://fosstodon.org/users/alice/statuses/98765432100');
    expect(info.platform).toBe('mastodon');
    expect(info.isValid).toBe(true);
  });

  it('refuse un profil Mastodon', () => {
    const info = detectPlatform('https://mastodon.social/@alice');
    expect(info.platform).toBe('mastodon');
    expect(info.isValid).toBe(false);
  });

  it('refuse un lookalike evilmastodon.social', () => {
    const info = detectPlatform('https://evilmastodon.social/@alice/123456789012345');
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('refuse mastodon.social.evil.com', () => {
    const info = detectPlatform('https://mastodon.social.evil.com/@alice/123456789012345');
    expect(info.isValid).toBe(false);
  });

  it('refuse une instance Mastodon hors allowlist', () => {
    const info = detectPlatform('https://random-site.example/@alice/123456789012345');
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('détecte une vidéo Vimeo', () => {
    const info = detectPlatform('https://vimeo.com/123456789');
    expect(info.platform).toBe('vimeo');
    expect(info.isValid).toBe(true);
  });

  it('détecte player.vimeo.com/video/ID', () => {
    const info = detectPlatform('https://player.vimeo.com/video/987654321');
    expect(info.platform).toBe('vimeo');
    expect(info.isValid).toBe(true);
  });

  it('détecte une vidéo Vimeo de chaîne', () => {
    const info = detectPlatform('https://vimeo.com/channels/staffpicks/76979871');
    expect(info.platform).toBe('vimeo');
    expect(info.isValid).toBe(true);
  });

  it('refuse une page Vimeo sans ID', () => {
    const info = detectPlatform('https://vimeo.com/watch');
    expect(info.platform).toBe('vimeo');
    expect(info.isValid).toBe(false);
  });

  it('refuse un lookalike evilvimeo.com', () => {
    const info = detectPlatform('https://evilvimeo.com/123456789');
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('refuse vimeo.com.evil.com', () => {
    const info = detectPlatform('https://vimeo.com.evil.com/123456789');
    expect(info.isValid).toBe(false);
  });

  it('refuse YouTube explicitement', () => {
    const info = detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(info.isValid).toBe(false);
    expect(info.error).toMatch(/YouTube/);
  });

  it('refuse youtu.be', () => {
    const info = detectPlatform('https://youtu.be/dQw4w9WgXcQ');
    expect(info.isValid).toBe(false);
    expect(info.error).toMatch(/YouTube/);
  });

  it('refuse javascript:', () => {
    const info = detectPlatform('javascript:alert(1)');
    expect(info.isValid).toBe(false);
  });

  it('extrait les identifiants', () => {
    expect(extractTweetId('https://x.com/u/status/42')).toBe('42');
    expect(extractInstagramShortcode('https://instagram.com/p/AbC123')).toBe('AbC123');
    expect(extractTikTokVideoId('https://www.tiktok.com/@u/video/99')).toBe('99');
    expect(extractThreadsShortcode('https://www.threads.net/@a/post/Dxyz')).toBe('Dxyz');
    expect(extractBlueskyPostRef('https://bsky.app/profile/alice.bsky.social/post/3kxyz')?.rkey).toBe(
      '3kxyz'
    );
    expect(extractRedditPostId('https://old.reddit.com/r/pics/comments/abc12de/title')).toBe(
      'abc12de'
    );
    expect(extractRedditPostId('https://redd.it/xyz987')).toBe('xyz987');
    expect(extractPinterestPinId('https://www.pinterest.com/pin/123456789012')).toBe('123456789012');
    expect(extractPinterestPinId('https://pin.it/Ab12CdEf')).toBe('Ab12CdEf');
    expect(extractMastodonStatusRef('https://mastodon.social/@alice/123456789012345')?.statusId).toBe(
      '123456789012345'
    );
    expect(extractMastodonStatusRef('https://evilmastodon.social/@alice/123456789012345')).toBeNull();
    expect(extractVimeoVideoRef('https://vimeo.com/123456789')?.id).toBe('123456789');
    expect(extractVimeoVideoRef('https://player.vimeo.com/video/987654321')?.id).toBe('987654321');
    expect(extractVimeoVideoRef('https://vimeo.com/123456789/abcdef12')?.hash).toBe('abcdef12');
    expect(extractVimeoVideoRef('https://evilvimeo.com/123456789')).toBeNull();
  });

  it('reconnaît uniquement les hôtes Pinterest réels', () => {
    expect(isPinterestHost('www.pinterest.com')).toBe(true);
    expect(isPinterestHost('pinterest.co.uk')).toBe(true);
    expect(isPinterestHost('pin.it')).toBe(true);
    expect(isPinterestHost('evilpinterest.com')).toBe(false);
    expect(isPinterestHost('pinterest.evil.com')).toBe(false);
    expect(isMastodonHost('mastodon.social')).toBe(true);
    expect(isMastodonHost('fosstodon.org')).toBe(true);
    expect(isMastodonHost('evilmastodon.social')).toBe(false);
    expect(isMastodonHost('mastodon.social.evil.com')).toBe(false);
    expect(isVimeoHost('vimeo.com')).toBe(true);
    expect(isVimeoHost('player.vimeo.com')).toBe(true);
    expect(isVimeoHost('www.vimeo.com')).toBe(true);
    expect(isVimeoHost('evilvimeo.com')).toBe(false);
    expect(isVimeoHost('vimeo.com.evil.com')).toBe(false);
  });

  it('nomme les plateformes', () => {
    expect(getPlatformName('tiktok')).toBe('TikTok');
    expect(getPlatformName('threads')).toBe('Threads');
    expect(getPlatformName('bluesky')).toBe('Bluesky');
    expect(getPlatformName('reddit')).toBe('Reddit');
    expect(getPlatformName('pinterest')).toBe('Pinterest');
    expect(getPlatformName('mastodon')).toBe('Mastodon');
    expect(getPlatformName('vimeo')).toBe('Vimeo');
    expect(getPlatformName('unknown')).toBe('Inconnu');
  });
});
