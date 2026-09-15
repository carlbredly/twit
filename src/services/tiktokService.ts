import { detectPlatform } from '../utils/linkDetector';
import { fetchJson } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseTikTokApiResponse } from './mediaParsers';

export const downloadTikTokMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'tiktok' };
  }

  const info = detectPlatform(validation.url.href);
  if (!info.isValid || info.platform !== 'tiktok') {
    return { success: false, error: 'URL TikTok invalide', platform: 'tiktok' };
  }

  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(validation.url.href)}&hd=1`;
    const data = await fetchJson(apiUrl, { signal });
    const mediaItems = data ? parseTikTokApiResponse(data) : [];
    if (mediaItems.length > 0) {
      return {
        success: true,
        mediaItems,
        mediaType: mediaItems[0].type,
        platform: 'tiktok',
      };
    }

    return {
      success: false,
      error: 'Impossible de télécharger le média TikTok. La vidéo est peut-être privée ou supprimée.',
      platform: 'tiktok',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'tiktok' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement TikTok',
      platform: 'tiktok',
    };
  }
};
