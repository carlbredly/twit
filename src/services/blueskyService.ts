import { extractBlueskyPostRef } from '../utils/linkDetector';
import { fetchJson } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseBlueskyThread } from './mediaParsers';

export const downloadBlueskyMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'bluesky' };
  }

  const ref = extractBlueskyPostRef(validation.url.href);
  if (!ref) {
    return { success: false, error: 'URL Bluesky invalide', platform: 'bluesky' };
  }

  try {
    const atUri = `at://${ref.handle}/app.bsky.feed.post/${ref.rkey}`;
    const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`;
    const data = await fetchJson(apiUrl, { signal });
    const mediaItems = data ? parseBlueskyThread(data) : [];

    if (mediaItems.length > 0) {
      return {
        success: true,
        mediaItems,
        mediaType: mediaItems[0].type,
        platform: 'bluesky',
      };
    }

    return {
      success: false,
      error:
        'Impossible de télécharger le média Bluesky. Le post est peut-être privé, sans média, ou supprimé.',
      platform: 'bluesky',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'bluesky' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Bluesky',
      platform: 'bluesky',
    };
  }
};
