import { coerceToHttpUrl, hostnameMatches, validatePublicHttpUrl, type UrlValidationResult } from './security';

export type Platform = 'instagram' | 'twitter' | 'snapchat' | 'tiktok' | 'unknown';
export type MediaType = 'video' | 'image' | 'gif' | 'unknown';

export interface LinkInfo {
  platform: Platform;
  isValid: boolean;
  url: string;
  canonicalUrl?: string;
  mediaType?: MediaType;
  error?: string;
}

const INSTAGRAM_HOSTS = ['instagram.com', 'instagr.am'] as const;
const TWITTER_HOSTS = ['twitter.com', 'x.com'] as const;
const SNAPCHAT_HOSTS = ['snapchat.com'] as const;
const TIKTOK_HOSTS = ['tiktok.com'] as const;
const TIKTOK_SHORT_HOSTS = ['vm.tiktok.com', 'vt.tiktok.com'] as const;
const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] as const;

const INSTAGRAM_PATH = /^\/(?:p|reel|reels|tv|stories)\/[A-Za-z0-9._-]+/i;
const INSTAGRAM_SHARE_PATH = /^\/share\/(?:p|reel)\/[A-Za-z0-9._-]+/i;
const TWITTER_PATH = /^\/(?:[A-Za-z0-9_]+|i)\/status\/\d+/i;
const SNAPCHAT_PATH = /^\/(?:t|spotlight|story)\/[A-Za-z0-9._-]+/i;
const TIKTOK_VIDEO_PATH = /^\/@[^/]+\/video\/\d+/i;
const TIKTOK_SHORT_PATH = /^\/(?:t|v)\/[A-Za-z0-9]+/i;
const TIKTOK_PHOTO_PATH = /^\/@[^/]+\/photo\/\d+/i;

export function detectPlatform(url: string): LinkInfo {
  if (!url || url.trim() === '') {
    return { platform: 'unknown', isValid: false, url, error: 'URL vide' };
  }

  const coerced = coerceToHttpUrl(url);
  const validation = validatePublicHttpUrl(coerced);
  if (!validation.ok) {
    return {
      platform: 'unknown',
      isValid: false,
      url,
      error: validation.error,
    };
  }

  return classifyUrl(validation.url, url);
}

function classifyUrl(parsed: URL, original: string): LinkInfo {
  const pathname = parsed.pathname;

  if (hostnameMatches(parsed.hostname, YOUTUBE_HOSTS)) {
    return {
      platform: 'unknown',
      isValid: false,
      url: original,
      canonicalUrl: parsed.href,
      error: 'YouTube n’est pas supporté',
    };
  }

  if (hostnameMatches(parsed.hostname, INSTAGRAM_HOSTS)) {
    const valid = INSTAGRAM_PATH.test(pathname) || INSTAGRAM_SHARE_PATH.test(pathname);
    return {
      platform: 'instagram',
      isValid: valid,
      url: original,
      canonicalUrl: parsed.href,
      error: valid ? undefined : 'Lien Instagram invalide. Utilisez un post, reel ou story.',
    };
  }

  if (hostnameMatches(parsed.hostname, TWITTER_HOSTS)) {
    const valid = TWITTER_PATH.test(pathname);
    return {
      platform: 'twitter',
      isValid: valid,
      url: original,
      canonicalUrl: parsed.href,
      error: valid ? undefined : 'Lien Twitter/X invalide. Format attendu : …/status/ID',
    };
  }

  if (hostnameMatches(parsed.hostname, SNAPCHAT_HOSTS)) {
    const valid = SNAPCHAT_PATH.test(pathname);
    return {
      platform: 'snapchat',
      isValid: valid,
      url: original,
      canonicalUrl: parsed.href,
      error: valid ? undefined : 'Lien Snapchat invalide. Seuls les snaps/stories publics sont acceptés.',
    };
  }

  if (hostnameMatches(parsed.hostname, TIKTOK_HOSTS)) {
    const shortHost = hostnameMatches(parsed.hostname, TIKTOK_SHORT_HOSTS) && pathname.length > 1;
    const valid =
      shortHost ||
      TIKTOK_VIDEO_PATH.test(pathname) ||
      TIKTOK_SHORT_PATH.test(pathname) ||
      TIKTOK_PHOTO_PATH.test(pathname);
    return {
      platform: 'tiktok',
      isValid: valid,
      url: original,
      canonicalUrl: parsed.href,
      error: valid ? undefined : 'Lien TikTok invalide. Utilisez une vidéo, photo ou un lien court.',
    };
  }

  return {
    platform: 'unknown',
    isValid: false,
    url: original,
    canonicalUrl: parsed.href,
    error: 'Plateforme non reconnue',
  };
}

export function extractTweetId(url: string): string | null {
  const parsed = parseIfAllowed(url, TWITTER_HOSTS);
  if (!parsed) return null;
  const match = parsed.pathname.match(/\/status\/(\d+)/i);
  return match?.[1] ?? null;
}

export function extractInstagramShortcode(url: string): string | null {
  const parsed = parseIfAllowed(url, INSTAGRAM_HOSTS);
  if (!parsed) return null;
  const match = parsed.pathname.match(
    /\/(?:p|reel|reels|tv|stories|share\/(?:p|reel))\/([A-Za-z0-9._-]+)/i
  );
  return match?.[1] ?? null;
}

export function extractTikTokVideoId(url: string): string | null {
  const parsed = parseIfAllowed(url, TIKTOK_HOSTS);
  if (!parsed) return null;
  const match = parsed.pathname.match(/\/(?:video|photo)\/(\d+)/i);
  return match?.[1] ?? null;
}

function parseIfAllowed(url: string, hosts: readonly string[]): URL | null {
  const validation = validatePublicHttpUrl(coerceToHttpUrl(url));
  if (!validation.ok) return null;
  if (!hostnameMatches(validation.url.hostname, hosts)) return null;
  return validation.url;
}

export function validateSocialUrl(url: string): UrlValidationResult {
  return validatePublicHttpUrl(coerceToHttpUrl(url));
}

export const getPlatformIcon = (platform: Platform): string => {
  switch (platform) {
    case 'instagram':
      return '📷';
    case 'twitter':
      return '🐦';
    case 'snapchat':
      return '👻';
    case 'tiktok':
      return '🎵';
    default:
      return '🔗';
  }
};

export const getPlatformName = (platform: Platform): string => {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'twitter':
      return 'Twitter/X';
    case 'snapchat':
      return 'Snapchat';
    case 'tiktok':
      return 'TikTok';
    default:
      return 'Inconnu';
  }
};

export const getPlatformColor = (platform: Platform): string => {
  switch (platform) {
    case 'instagram':
      return 'bg-gradient-to-r from-purple-500 to-pink-500';
    case 'twitter':
      return 'bg-gradient-to-r from-blue-400 to-blue-600';
    case 'snapchat':
      return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
    case 'tiktok':
      return 'bg-gradient-to-r from-gray-800 to-rose-600';
    default:
      return 'bg-gray-500';
  }
};
