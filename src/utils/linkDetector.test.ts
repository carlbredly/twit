import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  extractInstagramShortcode,
  extractTikTokVideoId,
  extractTweetId,
  getPlatformName,
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
  });

  it('nomme les plateformes', () => {
    expect(getPlatformName('tiktok')).toBe('TikTok');
    expect(getPlatformName('unknown')).toBe('Inconnu');
  });
});
