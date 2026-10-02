import { extractRedditPostId } from '../utils/linkDetector';
import { fetchJson } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseRedditListing } from './mediaParsers';

function redditJsonUrl(postId: string): string {
  return `https://www.reddit.com/comments/${encodeURIComponent(postId)}.json?raw_json=1`;
}

export const downloadRedditMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'reddit' };
  }

  const postId = extractRedditPostId(validation.url.href);
  if (!postId) {
    return { success: false, error: 'URL Reddit invalide', platform: 'reddit' };
  }

  try {
    const apiUrl = redditJsonUrl(postId);
    let data = await fetchJson(apiUrl, {
      headers: { Accept: 'application/json' },
      signal,
    });

    if (!data) {
      const proxyTarget = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
      const proxyCheck = validatePublicHttpUrl(proxyTarget);
      if (proxyCheck.ok) {
        data = await fetchJson(proxyCheck.url.href, { signal });
      }
    }

    const mediaItems = data ? parseRedditListing(data) : [];
    if (mediaItems.length > 0) {
      return {
        success: true,
        mediaItems,
        mediaType: mediaItems[0].type,
        platform: 'reddit',
      };
    }

    return {
      success: false,
      error:
        'Impossible de télécharger le média Reddit. Le post est peut-être privé, sans média, ou supprimé.',
      platform: 'reddit',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'reddit' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Reddit',
      platform: 'reddit',
    };
  }
};
