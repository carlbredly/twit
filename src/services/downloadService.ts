import type { Platform, MediaType } from '../utils/linkDetector';
import { resolveMediaFetchUrl } from '../utils/mediaProxy';
import { downloadInstagramMedia } from './instagramService';
import { downloadTwitterMedia } from './twitterService';
import { downloadSnapchatMedia } from './snapchatService';

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

const MIN_MEDIA_BYTES = 64;
const BLOB_REVOKE_DELAY_MS = 60_000;

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

const extensionForType = (type: MediaType, contentType?: string | null): string => {
  const mime = (contentType || '').toLowerCase();
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('mp4') || mime.includes('mpeg')) return 'mp4';
  if (mime.includes('webm')) return 'webm';

  // Twitter/X animated GIFs are delivered as MP4.
  if (type === 'gif' || type === 'video') return 'mp4';
  if (type === 'image') return 'jpg';
  return 'bin';
};

const isLikelyMediaContentType = (contentType: string | null): boolean => {
  if (!contentType) return true; // some CDNs omit it; size check still applies
  const mime = contentType.toLowerCase().split(';')[0].trim();
  if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
    return true;
  }
  if (mime === 'application/octet-stream') return true;
  return false;
};

export const triggerDownload = async (
  mediaUrl: string,
  filename: string,
  type: MediaType = 'video'
) => {
  const fetchUrl = resolveMediaFetchUrl(mediaUrl);
  const response = await fetch(fetchUrl, { redirect: 'follow' });

  if (!response.ok) {
    let detail = '';
    try {
      const text = await response.text();
      detail = text.slice(0, 120);
    } catch {
      // ignore
    }
    throw new Error(
      `Téléchargement impossible (${response.status})${detail ? `: ${detail}` : ''}`
    );
  }

  const contentType = response.headers.get('content-type');
  if (!isLikelyMediaContentType(contentType)) {
    throw new Error(`Type de fichier non média (${contentType || 'inconnu'})`);
  }

  const blob = await response.blob();
  if (blob.size < MIN_MEDIA_BYTES) {
    throw new Error(
      `Fichier téléchargé vide ou trop petit (${blob.size} octets). Le CDN a peut-être bloqué la requête.`
    );
  }

  const extension = extensionForType(type, blob.type || contentType);
  const blobUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filename || 'media'}.${extension}`;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    // Revoke after the browser has had time to start the download.
    // 100ms was too short and produced 0 KB files.
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), BLOB_REVOKE_DELAY_MS);
  }
};
