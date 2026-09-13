import { isSafeHttpUrl, normalizeInputUrl } from './security';

export type Platform = 'instagram' | 'twitter' | 'snapchat' | 'tiktok' | 'youtube' | 'unknown';
export type MediaType = 'video' | 'image' | 'gif' | 'unknown';

export interface LinkInfo {
  platform: Platform;
  isValid: boolean;
  url: string;
  mediaType?: MediaType;
  reason?: string;
}

const HOST_ALIASES: Record<string, Platform> = {
  'instagram.com': 'instagram',
  'instagr.am': 'instagram',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'mobile.twitter.com': 'twitter',
  'snapchat.com': 'snapchat',
  'story.snapchat.com': 'snapchat',
  'tiktok.com': 'tiktok',
  'vm.tiktok.com': 'tiktok',
  'vt.tiktok.com': 'tiktok',
  'm.tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'm.youtube.com': 'youtube',
  'www.youtube.com': 'youtube',
};

const matchesHost = (hostname: string, platform: Platform): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const withoutWww = host.startsWith('www.') ? host.slice(4) : host;
  if (HOST_ALIASES[host] === platform || HOST_ALIASES[withoutWww] === platform) {
    return true;
  }
  if (platform === 'instagram') {
    return withoutWww === 'instagram.com' || withoutWww.endsWith('.instagram.com');
  }
  if (platform === 'twitter') {
    return withoutWww === 'twitter.com' || withoutWww === 'x.com' || withoutWww.endsWith('.twitter.com');
  }
  if (platform === 'snapchat') {
    return withoutWww === 'snapchat.com' || withoutWww.endsWith('.snapchat.com');
  }
  if (platform === 'tiktok') {
    return withoutWww === 'tiktok.com' || withoutWww.endsWith('.tiktok.com');
  }
  if (platform === 'youtube') {
    return withoutWww === 'youtube.com' || withoutWww === 'youtu.be' || withoutWww.endsWith('.youtube.com');
  }
  return false;
};

const INSTAGRAM_MEDIA_PATH = /^\/(p|reel|reels|tv)\/[A-Za-z0-9_-]+\/?/;
const TWITTER_STATUS_PATH = /^\/(?:i\/(?:web\/)?|[A-Za-z0-9_]+\/)status\/\d+/;
const TWITTER_VIDEO_PATH = /^\/[A-Za-z0-9_]+\/video\/\d+/;
const SNAPCHAT_MEDIA_PATH = /^\/(t|spotlight|story)\/[A-Za-z0-9._-]+/;
const TIKTOK_VIDEO_PATH = /^\/@[\w.-]+\/video\/\d+/;
const TIKTOK_SHORT_PATH = /^\/t\/[A-Za-z0-9]+/;
const YOUTUBE_WATCH = /[?&]v=[\w-]{6,}/;
const YOUTUBE_SHORTS = /^\/(shorts|embed|watch)\/[\w-]{6,}/;
const YOUTUBE_BE = /^\/[\w-]{6,}/;

const detectFromParsedUrl = (parsed: URL, original: string): LinkInfo => {
  const path = parsed.pathname;

  if (matchesHost(parsed.hostname, 'instagram')) {
    if (INSTAGRAM_MEDIA_PATH.test(path)) {
      return { platform: 'instagram', isValid: true, url: original };
    }
    return {
      platform: 'instagram',
      isValid: false,
      url: original,
      reason: 'Lien Instagram reconnu, mais ce n’est pas un post, reel ou IGTV.',
    };
  }

  if (matchesHost(parsed.hostname, 'twitter')) {
    if (TWITTER_STATUS_PATH.test(path) || TWITTER_VIDEO_PATH.test(path)) {
      return { platform: 'twitter', isValid: true, url: original };
    }
    return {
      platform: 'twitter',
      isValid: false,
      url: original,
      reason: 'Lien Twitter/X reconnu, mais aucun identifiant de tweet n’a été trouvé.',
    };
  }

  if (matchesHost(parsed.hostname, 'snapchat')) {
    if (SNAPCHAT_MEDIA_PATH.test(path)) {
      return { platform: 'snapchat', isValid: true, url: original };
    }
    return {
      platform: 'snapchat',
      isValid: false,
      url: original,
      reason: 'Seuls les liens Spotlight, Story ou /t/ publics sont acceptés.',
    };
  }

  if (matchesHost(parsed.hostname, 'tiktok')) {
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (
      TIKTOK_VIDEO_PATH.test(path) ||
      TIKTOK_SHORT_PATH.test(path) ||
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com'
    ) {
      return { platform: 'tiktok', isValid: true, url: original };
    }
    return {
      platform: 'tiktok',
      isValid: false,
      url: original,
      reason: 'Lien TikTok reconnu, mais ce n’est pas une vidéo.',
    };
  }

  if (matchesHost(parsed.hostname, 'youtube')) {
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const looksLikeVideo =
      YOUTUBE_WATCH.test(parsed.search) ||
      YOUTUBE_SHORTS.test(path) ||
      (host === 'youtu.be' && YOUTUBE_BE.test(path));
    return {
      platform: 'youtube',
      isValid: false,
      url: original,
      reason: looksLikeVideo
        ? 'YouTube n’est pas supporté (droits d’auteur et conditions d’utilisation).'
        : 'Lien YouTube reconnu, mais ce n’est pas une vidéo.',
    };
  }

  return { platform: 'unknown', isValid: false, url: original, reason: 'Lien non reconnu' };
};

export const detectPlatform = (url: string): LinkInfo => {
  if (!url || url.trim() === '') {
    return { platform: 'unknown', isValid: false, url, reason: 'URL vide' };
  }

  const normalized = normalizeInputUrl(url);
  if (!isSafeHttpUrl(normalized)) {
    return {
      platform: 'unknown',
      isValid: false,
      url,
      reason: 'URL refusée pour des raisons de sécurité',
    };
  }

  try {
    return detectFromParsedUrl(new URL(normalized), url);
  } catch {
    return { platform: 'unknown', isValid: false, url, reason: 'URL malformée' };
  }
};

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
    case 'youtube':
      return '▶️';
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
    case 'youtube':
      return 'YouTube';
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
      return 'bg-gradient-to-r from-neutral-800 to-cyan-500';
    case 'youtube':
      return 'bg-gradient-to-r from-red-500 to-red-700';
    default:
      return 'bg-gray-500';
  }
};
