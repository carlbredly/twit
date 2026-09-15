import { extractTweetId } from '../utils/linkDetector';
import { fetchJson } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseFxTwitterResponse, parseVxTwitterResponse } from './mediaParsers';

export const downloadTwitterMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'twitter' };
  }

  const tweetId = extractTweetId(validation.url.href);
  if (!tweetId) {
    return { success: false, error: 'URL Twitter/X invalide', platform: 'twitter' };
  }

  try {
    const primary = await fetchJson(`https://api.fxtwitter.com/status/${tweetId}`, { signal });
    if (primary) {
      const mediaItems = parseFxTwitterResponse(primary);
      if (mediaItems.length > 0) {
        return {
          success: true,
          mediaItems,
          mediaType: mediaItems[0].type,
          platform: 'twitter',
        };
      }
    }

    return await downloadTwitterFallback(tweetId, signal);
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'twitter' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Twitter/X',
      platform: 'twitter',
    };
  }
};

const downloadTwitterFallback = async (
  tweetId: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const data = await fetchJson(`https://api.vxtwitter.com/tweet/${tweetId}`, { signal });
  if (data) {
    const mediaItems = parseVxTwitterResponse(data);
    if (mediaItems.length > 0) {
      return {
        success: true,
        mediaItems,
        mediaType: mediaItems[0].type,
        platform: 'twitter',
      };
    }
  }

  return {
    success: false,
    error: 'Impossible de télécharger le média Twitter/X. Le tweet est peut-être privé ou supprimé.',
    platform: 'twitter',
  };
};
