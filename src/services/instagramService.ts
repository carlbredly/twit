import { extractInstagramShortcode } from '../utils/linkDetector';
import { fetchValidated } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseGenericDownloaderItems, toSafeMediaUrl } from './mediaParsers';

const DOWNLOADER_ENDPOINTS = [
  'https://instadownloader.org/api/ajaxSearch',
  'https://api.saveig.app/api/ajaxSearch',
  'https://saveig.app/api/ajaxSearch',
] as const;

export const downloadInstagramMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'instagram' };
  }

  const shortcode = extractInstagramShortcode(validation.url.href);
  if (!shortcode) {
    return {
      success: false,
      error: 'URL Instagram invalide. Format attendu: instagram.com/p/... ou instagram.com/reel/...',
      platform: 'instagram',
    };
  }

  try {
    for (const endpoint of DOWNLOADER_ENDPOINTS) {
      const mediaItems = await queryDownloader(endpoint, validation.url.href, signal);
      if (mediaItems.length > 0) {
        return {
          success: true,
          mediaItems,
          mediaType: mediaItems[0].type,
          platform: 'instagram',
        };
      }
    }

    return {
      success: false,
      error:
        'Impossible de télécharger le média Instagram. Le post est peut-être privé, supprimé ou le lien est invalide. Assurez-vous que le compte est public.',
      platform: 'instagram',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'instagram' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Instagram',
      platform: 'instagram',
    };
  }
};

async function queryDownloader(endpoint: string, targetUrl: string, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append('q', targetUrl);
  formData.append('t', 'media');
  formData.append('lang', 'en');

  const response = await fetchValidated(endpoint, {
    method: 'POST',
    body: formData,
    signal,
  });
  if (!response?.ok) return [];
  const data: unknown = await response.json();
  return parseGenericDownloaderItems(data).filter((item) => toSafeMediaUrl(item.url));
}
