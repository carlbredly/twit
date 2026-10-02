import { coerceToHttpUrl, hostnameMatches, validatePublicHttpUrl, type UrlValidationResult } from './security';
import { stripTrackingParams } from './tracking';

export type Platform =
  | 'instagram'
  | 'twitter'
  | 'snapchat'
  | 'tiktok'
  | 'threads'
  | 'bluesky'
  | 'reddit'
  | 'pinterest'
  | 'unknown';
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
const THREADS_HOSTS = ['threads.net', 'threads.com'] as const;
const BLUESKY_HOSTS = ['bsky.app', 'bsky.social'] as const;
const REDDIT_HOSTS = ['reddit.com', 'redd.it'] as const;
const PINTEREST_HOSTS = ['pinterest.com', 'pin.it'] as const;
const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] as const;

const INSTAGRAM_PATH = /^\/(?:p|reel|reels|tv|stories)\/[A-Za-z0-9._-]+/i;
const INSTAGRAM_SHARE_PATH = /^\/share\/(?:p|reel)\/[A-Za-z0-9._-]+/i;
const TWITTER_PATH = /^\/(?:[A-Za-z0-9_]+|i)\/status\/\d+/i;
const SNAPCHAT_PATH = /^\/(?:t|spotlight|story)\/[A-Za-z0-9._-]+/i;
const TIKTOK_VIDEO_PATH = /^\/@[^/]+\/video\/\d+/i;
const TIKTOK_SHORT_PATH = /^\/(?:t|v)\/[A-Za-z0-9]+/i;
const TIKTOK_PHOTO_PATH = /^\/@[^/]+\/photo\/\d+/i;
const THREADS_POST_PATH = /^\/@[^/]+\/post\/[A-Za-z0-9._-]+/i;
const THREADS_SHORT_PATH = /^\/t\/[A-Za-z0-9._-]+/i;
const BLUESKY_POST_PATH = /^\/profile\/[^/]+\/post\/[A-Za-z0-9._~-]+/i;
const REDDIT_POST_PATH = /^\/(?:r\/[^/]+\/comments|comments|gallery)\/[A-Za-z0-9]+/i;
const REDDIT_SHORT_PATH = /^\/[A-Za-z0-9]{5,12}\/?$/i;
const PINTEREST_PIN_PATH = /^\/pin\/[A-Za-z0-9._-]+/i;
const PINTEREST_SHORT_PATH = /^\/[A-Za-z0-9]{5,20}\/?$/i;

/** pinterest.com, www.pinterest.fr, pinterest.co.uk — pas evilpinterest.com. */
export function isPinterestHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'pin.it' || host.endsWith('.pin.it')) return true;
  if (hostnameMatches(host, PINTEREST_HOSTS)) return true;
  if (/^(?:www\.)?pinterest\.[a-z]{2,3}$/.test(host)) return true;
  if (/^(?:www\.)?pinterest\.(?:co|com)\.[a-z]{2}$/.test(host)) return true;
  return false;
}

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

  return classifyUrl(stripTrackingParams(validation.url), url);
}

function classifyUrl(parsed: URL, original: string): LinkInfo {
  const pathname = parsed.pathname;
  const canonicalUrl = parsed.href;

  if (hostnameMatches(parsed.hostname, YOUTUBE_HOSTS)) {
    return {
      platform: 'unknown',
      isValid: false,
      url: original,
      canonicalUrl,
      error: 'YouTube n’est pas supporté',
    };
  }

  if (hostnameMatches(parsed.hostname, INSTAGRAM_HOSTS)) {
    const valid = INSTAGRAM_PATH.test(pathname) || INSTAGRAM_SHARE_PATH.test(pathname);
    return {
      platform: 'instagram',
      isValid: valid,
      url: original,
      canonicalUrl,
      error: valid ? undefined : 'Lien Instagram invalide. Utilisez un post, reel ou story.',
    };
  }

  if (hostnameMatches(parsed.hostname, TWITTER_HOSTS)) {
    const valid = TWITTER_PATH.test(pathname);
    return {
      platform: 'twitter',
      isValid: valid,
      url: original,
      canonicalUrl,
      error: valid ? undefined : 'Lien Twitter/X invalide. Format attendu : …/status/ID',
    };
  }

  if (hostnameMatches(parsed.hostname, SNAPCHAT_HOSTS)) {
    const valid = SNAPCHAT_PATH.test(pathname);
    return {
      platform: 'snapchat',
      isValid: valid,
      url: original,
      canonicalUrl,
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
      canonicalUrl,
      error: valid ? undefined : 'Lien TikTok invalide. Utilisez une vidéo, photo ou un lien court.',
    };
  }

  if (hostnameMatches(parsed.hostname, THREADS_HOSTS)) {
    const valid = THREADS_POST_PATH.test(pathname) || THREADS_SHORT_PATH.test(pathname);
    return {
      platform: 'threads',
      isValid: valid,
      url: original,
      canonicalUrl,
      error: valid ? undefined : 'Lien Threads invalide. Utilisez un post @user/post/… ou /t/…',
    };
  }

  if (hostnameMatches(parsed.hostname, BLUESKY_HOSTS)) {
    const valid = BLUESKY_POST_PATH.test(pathname);
    return {
      platform: 'bluesky',
      isValid: valid,
      url: original,
      canonicalUrl,
      error: valid ? undefined : 'Lien Bluesky invalide. Format attendu : /profile/…/post/…',
    };
  }

  if (hostnameMatches(parsed.hostname, REDDIT_HOSTS)) {
    const isShortHost = parsed.hostname.replace(/\.$/, '').toLowerCase() === 'redd.it'
      || parsed.hostname.toLowerCase().endsWith('.redd.it');
    const valid = isShortHost
      ? REDDIT_SHORT_PATH.test(pathname)
      : REDDIT_POST_PATH.test(pathname);
    return {
      platform: 'reddit',
      isValid: valid,
      url: original,
      canonicalUrl,
      error: valid ? undefined : 'Lien Reddit invalide. Utilisez un post /r/…/comments/…, /gallery/… ou redd.it/…',
    };
  }

  if (isPinterestHost(parsed.hostname)) {
    const host = parsed.hostname.replace(/\.$/, '').toLowerCase();
    const isShortHost = host === 'pin.it' || host.endsWith('.pin.it');
    const valid = isShortHost
      ? PINTEREST_SHORT_PATH.test(pathname)
      : PINTEREST_PIN_PATH.test(pathname);
    return {
      platform: 'pinterest',
      isValid: valid,
      url: original,
      canonicalUrl,
      error: valid ? undefined : 'Lien Pinterest invalide. Utilisez un pin /pin/… ou pin.it/…',
    };
  }

  return {
    platform: 'unknown',
    isValid: false,
    url: original,
    canonicalUrl,
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

export function extractThreadsShortcode(url: string): string | null {
  const parsed = parseIfAllowed(url, THREADS_HOSTS);
  if (!parsed) return null;
  const match = parsed.pathname.match(/\/(?:post|t)\/([A-Za-z0-9._-]+)/i);
  return match?.[1] ?? null;
}

export function extractBlueskyPostRef(url: string): { handle: string; rkey: string } | null {
  const parsed = parseIfAllowed(url, BLUESKY_HOSTS);
  if (!parsed) return null;
  const match = parsed.pathname.match(/^\/profile\/([^/]+)\/post\/([A-Za-z0-9._~-]+)/i);
  if (!match) return null;
  return { handle: decodeURIComponent(match[1]), rkey: match[2] };
}

export function extractRedditPostId(url: string): string | null {
  const parsed = parseIfAllowed(url, REDDIT_HOSTS);
  if (!parsed) return null;
  const host = parsed.hostname.replace(/\.$/, '').toLowerCase();
  if (host === 'redd.it' || host.endsWith('.redd.it')) {
    const short = parsed.pathname.match(/^\/([A-Za-z0-9]{5,12})\/?$/);
    return short?.[1] ?? null;
  }
  const match = parsed.pathname.match(
    /\/(?:r\/[^/]+\/comments|comments|gallery)\/([A-Za-z0-9]+)/i
  );
  return match?.[1] ?? null;
}

export function extractPinterestPinId(url: string): string | null {
  const validation = validatePublicHttpUrl(coerceToHttpUrl(url));
  if (!validation.ok || !isPinterestHost(validation.url.hostname)) return null;
  const host = validation.url.hostname.replace(/\.$/, '').toLowerCase();
  if (host === 'pin.it' || host.endsWith('.pin.it')) {
    const short = validation.url.pathname.match(/^\/([A-Za-z0-9]{5,20})\/?$/);
    return short?.[1] ?? null;
  }
  const match = validation.url.pathname.match(/^\/pin\/([A-Za-z0-9._-]+)/i);
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
    case 'threads':
      return '🧵';
    case 'bluesky':
      return '🦋';
    case 'reddit':
      return '🟠';
    case 'pinterest':
      return '📌';
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
    case 'threads':
      return 'Threads';
    case 'bluesky':
      return 'Bluesky';
    case 'reddit':
      return 'Reddit';
    case 'pinterest':
      return 'Pinterest';
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
    case 'threads':
      return 'bg-gradient-to-r from-slate-800 to-indigo-500';
    case 'bluesky':
      return 'bg-gradient-to-r from-sky-500 to-blue-700';
    case 'reddit':
      return 'bg-gradient-to-r from-orange-500 to-red-600';
    case 'pinterest':
      return 'bg-gradient-to-r from-rose-600 to-red-700';
    default:
      return 'bg-gray-500';
  }
};
