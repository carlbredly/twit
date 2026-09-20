import type { Platform, MediaType } from '../utils/linkDetector';
import { buildProxiedDownloadUrl, isAllowedProxyTarget } from '../utils/mediaProxy';
import { downloadInstagramMedia } from './instagramService';
import { downloadTwitterMedia } from './twitterService';
import { downloadSnapchatMedia } from './snapchatService';

export interface MediaItem {
  url: string;
  type: MediaType;
  thumbnail?: string;
  /** Human label, e.g. "1280×720 (HD)" */
  label?: string;
  /** Short quality tag, e.g. "720p" */
  quality?: string;
  width?: number;
  height?: number;
  bitrate?: number;
}

export interface DownloadResponse {
  success: boolean;
  mediaItems?: MediaItem[];
  error?: string;
  platform?: Platform;
  mediaType?: MediaType;
}

export const downloadMedia = async (
  url: string,
  platform: Platform
): Promise<DownloadResponse> => {
  try {
    switch (platform) {
      case 'instagram':
        return await downloadInstagramMedia(url);
      case 'twitter':
        return await downloadTwitterMedia(url);
      case 'snapchat':
        return await downloadSnapchatMedia(url);
      default:
        return {
          success: false,
          error: 'Plateforme non supportée',
          platform,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      platform,
    };
  }
};

const extensionForType = (type: MediaType): string => {
  // Twitter/X animated GIFs are delivered as MP4 (same as ssstwitter).
  if (type === 'gif' || type === 'video') return 'mp4';
  if (type === 'image') return 'jpg';
  return 'bin';
};

/**
 * Trigger a real browser file download the same way ssstwitter does:
 * navigate to a same-origin proxy URL that streams bytes with
 * Content-Disposition: attachment — no blob / fetch in the page.
 */
export const triggerDownload = async (
  mediaUrl: string,
  filename: string,
  type: MediaType = 'video'
) => {
  const extension = extensionForType(type);
  const safeName = `${filename || 'twitter_media'}.${extension}`;

  const allowed = isAllowedProxyTarget(mediaUrl);
  const href = allowed.ok
    ? buildProxiedDownloadUrl(mediaUrl, safeName)
    : mediaUrl;

  // Prefer a real navigation download (ssscdn-style). Avoid fetch→blob
  // which is what produced 0 KB files when the CDN returned 403.
  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener noreferrer';
  // download attribute helps same-origin proxy responses
  link.setAttribute('download', safeName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
