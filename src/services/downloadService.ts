import type { DownloadResponse, MediaItem } from '../types/media';
import type { MediaType, Platform } from '../utils/linkDetector';
import {
  extensionForMediaType,
  isAllowedMediaContentType,
  MAX_MEDIA_BYTES,
  parseContentLength,
  sanitizeFilename,
  validatePublicHttpUrl,
} from '../utils/security';
import { downloadInstagramMedia } from './instagramService';
import { downloadSnapchatMedia } from './snapchatService';
import { downloadTikTokMedia } from './tiktokService';
import { downloadTwitterMedia } from './twitterService';

export type { DownloadResponse, MediaItem };

export const downloadMedia = async (
  url: string,
  platform: Platform
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform };
  }

  try {
    switch (platform) {
      case 'instagram':
        return await downloadInstagramMedia(validation.url.href);
      case 'twitter':
        return await downloadTwitterMedia(validation.url.href);
      case 'snapchat':
        return await downloadSnapchatMedia(validation.url.href);
      case 'tiktok':
        return await downloadTikTokMedia(validation.url.href);
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

export const triggerDownload = async (
  mediaUrl: string,
  filename: string,
  type: MediaType = 'video'
) => {
  const validation = validatePublicHttpUrl(mediaUrl, { httpsOnly: true });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const safeName = sanitizeFilename(filename);
  const response = await fetch(validation.url.href, { redirect: 'follow' });

  if (!response.ok) {
    throw new Error(`Téléchargement impossible (${response.status})`);
  }

  const finalUrl = validatePublicHttpUrl(response.url, { httpsOnly: true });
  if (!finalUrl.ok) {
    throw new Error('Redirection vers un hôte non autorisé');
  }

  const contentLength = parseContentLength(response.headers.get('content-length'));
  if (contentLength !== null && contentLength > MAX_MEDIA_BYTES) {
    throw new Error('Fichier trop volumineux');
  }
  if (!isAllowedMediaContentType(response.headers.get('content-type'))) {
    throw new Error('Type de fichier non autorisé');
  }

  const blob = await response.blob();
  if (blob.size > MAX_MEDIA_BYTES) {
    throw new Error('Fichier trop volumineux');
  }
  if (!isAllowedMediaContentType(blob.type || null)) {
    throw new Error('Type de fichier non autorisé');
  }

  const extension = extensionForMediaType(type, blob.type || response.headers.get('content-type') || undefined);
  const blobUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${safeName}.${extension}`;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  }
};
