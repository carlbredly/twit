import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  extractInstagramShortcode,
  extractTikTokVideoId,
  extractTweetId,
  getPlatformName,
} from './linkDetector';

describe('detectPlatform', () => {
  it('détecte Instagram, Twitter, Snapchat et TikTok', () => {
    expect(detectPlatform('https://www.instagram.com/reel/AbC123xyz/').platform).toBe('instagram');
    expect(detectPlatform('https://www.instagram.com/reel/AbC123xyz/').isValid).toBe(true);
    expect(detectPlatform('https://x.com/user/status/1234567890').platform).toBe('twitter');
    expect(detectPlatform('https://twitter.com/i/status/1234567890').isValid).toBe(true);
    expect(detectPlatform('https://www.snapchat.com/spotlight/W7abc').isValid).toBe(true);
    expect(detectPlatform('https://www.tiktok.com/@creator/video/7123456789012345678').platform).toBe('tiktok');
    expect(detectPlatform('https://vm.tiktok.com/t/ZMabcdef/').isValid).toBe(true);
  });

  it('rejette les faux hôtes qui imitent une plateforme', () => {
    expect(detectPlatform('https://instagram.com.evil.com/p/abc').isValid).toBe(false);
    expect(detectPlatform('https://evil.com/instagram.com/p/abc').platform).toBe('unknown');
    expect(detectPlatform('https://not-x.com/user/status/1').isValid).toBe(false);
  });

  it('ne traite plus un profil Instagram ou un lien Snap add comme média', () => {
    expect(detectPlatform('https://www.instagram.com/someuser/tagged').isValid).toBe(false);
    expect(detectPlatform('https://www.snapchat.com/add/someone').isValid).toBe(false);
  });

  it('refuse les schémas non HTTP même s’ils mentionnent une plateforme', () => {
    const info = detectPlatform("javascript:alert('https://instagram.com/p/abc')");
    expect(info.isValid).toBe(false);
    expect(info.platform).toBe('unknown');
  });

  it('accepte les nouveaux liens de partage Instagram', () => {
    expect(detectPlatform('https://www.instagram.com/share/reel/AbCdef123/').isValid).toBe(true);
  });
});

describe('extractors', () => {
  it('extrait les identifiants de médias', () => {
    expect(extractTweetId('https://x.com/foo/status/9876543210')).toBe('9876543210');
    expect(extractInstagramShortcode('https://www.instagram.com/p/Short_code-1/')).toBe('Short_code-1');
    expect(extractTikTokVideoId('https://www.tiktok.com/@u/video/111')).toBe('111');
  });

  it('ne lit pas un identifiant hors du bon hôte', () => {
    expect(extractTweetId('https://evil.com/x.com/user/status/1')).toBeNull();
    expect(extractInstagramShortcode('https://example.com/instagram.com/p/abc')).toBeNull();
  });
});

describe('getPlatformName', () => {
  it('nomme TikTok', () => {
    expect(getPlatformName('tiktok')).toBe('TikTok');
  });
});
