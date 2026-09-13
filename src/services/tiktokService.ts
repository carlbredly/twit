import { detectPlatform } from '../utils/linkDetector';
import { validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseTikTokApiResponse } from './mediaParsers';

export const downloadTikTokMedia = async (url: string): Promise<DownloadResponse> => {
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
    const apiCheck = validatePublicHttpUrl(apiUrl);
    if (!apiCheck.ok) {
      return { success: false, error: 'Endpoint TikTok invalide', platform: 'tiktok' };
    }

    const response = await fetch(apiCheck.url.href, {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data: unknown = await response.json();
      const mediaItems = parseTikTokApiResponse(data);
      if (mediaItems.length > 0) {
        return {
          success: true,
          mediaItems,
          mediaType: mediaItems[0].type,
          platform: 'tiktok',
        };
      }
    }

    return {
      success: false,
      error: 'Impossible de télécharger le média TikTok. La vidéo est peut-être privée ou supprimée.',
      platform: 'tiktok',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement TikTok',
      platform: 'tiktok',
    };
  }
};
