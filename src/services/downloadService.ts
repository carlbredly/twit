import type { Platform, MediaType } from '../utils/linkDetector';
import {
  MAX_DOWNLOAD_BYTES,
  MAX_MEDIA_ITEMS,
  assertSafeMediaUrl,
  isAllowedMediaContentType,
  isSafeMediaUrl,
  sanitizeFilename,
} from '../utils/security';
import { extensionForMediaType } from '../utils/mediaHelpers';
import { downloadInstagramMedia } from './instagramService';
import { downloadTwitterMedia } from './twitterService';
import { downloadSnapchatMedia } from './snapchatService';
import { downloadTikTokMedia } from './tiktokService';

export interface MediaItem {
  url: string;
  type: MediaType;
  thumbnail?: string;
}

export interface DownloadResponse {
  success: boolean;
  mediaItems?: MediaItem[];
  error?: string;
  platform?: Platform;
  mediaType?: MediaType;
}

export const filterSafeMediaItems = (items: MediaItem[]): MediaItem[] => {
  return items
    .filter((item) => isSafeMediaUrl(item.url) && (!item.thumbnail || isSafeMediaUrl(item.thumbnail)))
    .slice(0, MAX_MEDIA_ITEMS);
};

export const downloadMedia = async (
  url: string,
  platform: Platform
): Promise<DownloadResponse> => {
  try {
    let result: DownloadResponse;

    switch (platform) {
      case 'instagram':
        result = await downloadInstagramMedia(url);
        break;
      case 'twitter':
        result = await downloadTwitterMedia(url);
        break;
      case 'snapchat':
        result = await downloadSnapchatMedia(url);
        break;
      case 'tiktok':
        result = await downloadTikTokMedia(url);
        break;
      case 'youtube':
        return {
          success: false,
          error: 'YouTube n’est pas supporté (droits d’auteur et conditions d’utilisation).',
          platform,
        };
      default:
        return {
          success: false,
          error: 'Plateforme non supportée',
          platform,
        };
    }

    if (result.success && result.mediaItems) {
      const safeItems = filterSafeMediaItems(result.mediaItems);
      if (safeItems.length === 0) {
        return {
          success: false,
          error: 'Les médias extraits ont été bloqués par le filtre de sécurité.',
          platform,
        };
      }
      return { ...result, mediaItems: safeItems, platform };
    }

    return { ...result, platform };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      platform,
    };
  }
};

const downloadViaAnchor = (href: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const triggerDownload = async (
  mediaUrl: string,
  filename: string,
  type: MediaType = 'video'
): Promise<void> => {
  const safeUrl = assertSafeMediaUrl(mediaUrl);
  const safeName = `${sanitizeFilename(filename || 'media')}.${extensionForMediaType(type)}`;

  const response = await fetch(safeUrl.toString(), {
    method: 'GET',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });

  if (!response.ok) {
    throw new Error(`Téléchargement refusé (HTTP ${response.status})`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !isAllowedMediaContentType(contentType)) {
    throw new Error('Type de contenu non autorisé');
  }

  const contentLength = Number(response.headers.get('content-length') || '0');
  if (contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error('Fichier trop volumineux');
  }

  const blob = await response.blob();
  if (blob.size > MAX_DOWNLOAD_BYTES) {
    throw new Error('Fichier trop volumineux');
  }

  const blobUrl = URL.createObjectURL(blob);
  try {
    downloadViaAnchor(blobUrl, safeName);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  }
};
