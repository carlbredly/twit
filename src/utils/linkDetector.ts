export type Platform = 'instagram' | 'twitter' | 'snapchat' | 'unknown';

export interface LinkInfo {
  platform: Platform;
  isValid: boolean;
  url: string;
}

export const detectPlatform = (url: string): LinkInfo => {
  if (!url || url.trim() === '') {
    return { platform: 'unknown', isValid: false, url };
  }

  const normalizedUrl = url.trim().toLowerCase();

  // Instagram patterns
  const instagramPatterns = [
    /instagram\.com\/(p|reel|tv)\//,
    /instagram\.com\/.*\/.*/,
  ];

  // Twitter/X patterns
  const twitterPatterns = [
    /(twitter\.com|x\.com)\/.*\/status\//,
    /(twitter\.com|x\.com)\/.*\/video\//,
  ];

  // Snapchat patterns
  const snapchatPatterns = [
    /snapchat\.com\/add\//,
    /snapchat\.com\/t\//,
    /snapchat\.com\/story\//,
  ];

  for (const pattern of instagramPatterns) {
    if (pattern.test(normalizedUrl)) {
      return { platform: 'instagram', isValid: true, url };
    }
  }

  for (const pattern of twitterPatterns) {
    if (pattern.test(normalizedUrl)) {
      return { platform: 'twitter', isValid: true, url };
    }
  }

  for (const pattern of snapchatPatterns) {
    if (pattern.test(normalizedUrl)) {
      return { platform: 'snapchat', isValid: true, url };
    }
  }

  return { platform: 'unknown', isValid: false, url };
};

export const getPlatformIcon = (platform: Platform): string => {
  switch (platform) {
    case 'instagram':
      return '📷';
    case 'twitter':
      return '🐦';
    case 'snapchat':
      return '👻';
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
    default:
      return 'bg-gray-500';
  }
};

