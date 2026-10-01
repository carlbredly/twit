import type { DownloadResponse, MediaItem } from '../types/media';
import type { MediaType, Platform } from '../utils/linkDetector';
import { fetchValidated } from '../utils/http';
import { buildProxiedDownloadUrl, isAllowedProxyTarget } from '../utils/mediaProxy';
import {
  extensionForMediaType,
  isAbortError,
  isAllowedMediaContentType,
  MAX_MEDIA_BYTES,
  parseContentLength,
  sanitizeFilename,
  validatePublicHttpUrl,
} from '../utils/security';
import { downloadBlueskyMedia } from './blueskyService';
import { downloadInstagramMedia } from './instagramService';
import { downloadRedditMedia } from './redditService';
import { downloadSnapchatMedia } from './snapchatService';
import { downloadThreadsMedia } from './threadsService';
import { downloadTikTokMedia } from './tiktokService';
import { downloadTwitterMedia } from './twitterService';

export type { DownloadResponse, MediaItem };

export const downloadMedia = async (
  url: string,
  platform: Platform,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform };
  }

  if (signal?.aborted) {
    return { success: false, error: 'Recherche annulée', platform };
  }

  try {
    switch (platform) {
      case 'instagram':
        return await downloadInstagramMedia(validation.url.href, signal);
      case 'twitter':
        return await downloadTwitterMedia(validation.url.href, signal);
      case 'snapchat':
        return await downloadSnapchatMedia(validation.url.href, signal);
      case 'tiktok':
        return await downloadTikTokMedia(validation.url.href, signal);
      case 'threads':
        return await downloadThreadsMedia(validation.url.href, signal);
      case 'bluesky':
        return await downloadBlueskyMedia(validation.url.href, signal);
      case 'reddit':
        return await downloadRedditMedia(validation.url.href, signal);
      default:
        return {
          success: false,
          error: 'Plateforme non supportée',
          platform,
        };
    }
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      return { success: false, error: 'Recherche annulée', platform };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      platform,
    };
  }
};

const clickAnchor = (href: string, filename: string) => {
  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener noreferrer';
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Twitter/X CDN: same-origin proxy with Content-Disposition (avoids 0 KB CORS files).
 * Other public HTTPS media: fetch + MIME/size checks, then blob download.
 */
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
  const allowed = isAllowedProxyTarget(validation.url.href);

  if (allowed.ok) {
    const extension = extensionForMediaType(type);
    const fullName = `${safeName}.${extension}`;
    clickAnchor(buildProxiedDownloadUrl(validation.url.href, fullName), fullName);
    return;
  }

  const response = await fetchValidated(validation.url.href, { redirect: 'follow' }, { httpsOnly: true });

  if (!response) {
    throw new Error('Téléchargement impossible');
  }
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
    clickAnchor(blobUrl, `${safeName}.${extension}`);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  }
};
