import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  getPlatformColor,
  getPlatformIcon,
  getPlatformName,
} from './linkDetector';

describe('detectPlatform', () => {
  it('détecte Instagram posts, reels et IGTV uniquement', () => {
    expect(detectPlatform('https://www.instagram.com/p/AbC123/').isValid).toBe(true);
    expect(detectPlatform('https://instagram.com/reel/AbC123/').platform).toBe('instagram');
    expect(detectPlatform('https://www.instagram.com/tv/AbC123/').isValid).toBe(true);
    expect(detectPlatform('instagram.com/reels/AbC123').isValid).toBe(true);
  });

  it('rejette les profils et pages Instagram non médias', () => {
    const profile = detectPlatform('https://www.instagram.com/nasa/');
    expect(profile.platform).toBe('instagram');
    expect(profile.isValid).toBe(false);

    const explore = detectPlatform('https://www.instagram.com/explore/tags/cats/');
    expect(explore.isValid).toBe(false);
  });

  it('détecte Twitter/X y compris x.com et /i/status', () => {
    expect(detectPlatform('https://twitter.com/user/status/1234567890').isValid).toBe(true);
    expect(detectPlatform('https://x.com/user/status/1234567890').platform).toBe('twitter');
    expect(detectPlatform('https://x.com/i/status/1234567890').isValid).toBe(true);
    expect(detectPlatform('https://mobile.twitter.com/user/status/1').isValid).toBe(true);
  });

  it('détecte TikTok vidéos et liens courts', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/1234567890123456789').isValid).toBe(true);
    expect(detectPlatform('https://vm.tiktok.com/ZMabcdef/').isValid).toBe(true);
    expect(detectPlatform('https://www.tiktok.com/@user').isValid).toBe(false);
  });

  it('accepte uniquement Spotlight/Story/t pour Snapchat', () => {
    expect(detectPlatform('https://www.snapchat.com/spotlight/abc123').isValid).toBe(true);
    expect(detectPlatform('https://www.snapchat.com/t/abc123').isValid).toBe(true);
    expect(detectPlatform('https://www.snapchat.com/add/someone').isValid).toBe(false);
  });

  it('reconnaît YouTube sans l’activer', () => {
    const info = detectPlatform('https://www.youtube.com/watch?v=dQw4w9wgGcI');
    expect(info.platform).toBe('youtube');
    expect(info.isValid).toBe(false);
    expect(info.reason).toMatch(/supporté/i);
  });

  it('refuse les domaines lookalike (confusion d’hôte)', () => {
    expect(detectPlatform('https://evilinstagram.com/p/abc').isValid).toBe(false);
    expect(detectPlatform('https://nottwitter.com/user/status/1').isValid).toBe(false);
    expect(detectPlatform('https://example.com/instagram.com/p/abc').isValid).toBe(false);
  });

  it('refuse les schémas dangereux même s’ils mentionnent une plateforme', () => {
    expect(detectPlatform('javascript:alert(1)').isValid).toBe(false);
    expect(detectPlatform('https://127.0.0.1/instagram.com/p/abc').isValid).toBe(false);
  });

  it('expose les libellés et couleurs des plateformes', () => {
    expect(getPlatformName('tiktok')).toBe('TikTok');
    expect(getPlatformIcon('snapchat')).toBe('👻');
    expect(getPlatformColor('unknown')).toContain('gray');
  });
});
