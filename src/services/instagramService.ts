import { detectPlatform } from '../utils/linkDetector';
import { fetchValidated } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseGenericDownloaderItems } from './mediaParsers';

const INSTAGRAM_ENDPOINTS = [
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

  const info = detectPlatform(validation.url.href);
  if (!info.isValid || info.platform !== 'instagram') {
    return {
      success: false,
      error: info.error || 'URL Instagram invalide',
      platform: 'instagram',
    };
  }

  const canonical = info.canonicalUrl ?? validation.url.href;

  try {
    for (const endpoint of INSTAGRAM_ENDPOINTS) {
      if (signal?.aborted) {
        return { success: false, error: 'Recherche annulée', platform: 'instagram' };
      }

      const formData = new FormData();
      formData.append('q', canonical);
      formData.append('t', 'media');
      formData.append('lang', 'en');

      const response = await fetchValidated(endpoint, {
        method: 'POST',
        body: formData,
        signal,
      });

      if (!response?.ok) continue;

      try {
        const data: unknown = await response.json();
        const mediaItems = parseGenericDownloaderItems(data);
        if (mediaItems.length > 0) {
          return {
            success: true,
            mediaItems,
            mediaType: mediaItems[0].type,
            platform: 'instagram',
          };
        }
      } catch {
        continue;
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
