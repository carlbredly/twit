import { detectPlatform } from '../utils/linkDetector';
import { fetchJson, fetchValidated } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseGenericDownloaderItems, parseOEmbedThumbnail, parseOpenGraphMedia } from './mediaParsers';

const GENERIC_ENDPOINTS = [
  'https://instadownloader.org/api/ajaxSearch',
  'https://api.saveig.app/api/ajaxSearch',
] as const;

export const downloadThreadsMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'threads' };
  }

  const info = detectPlatform(validation.url.href);
  if (!info.isValid || info.platform !== 'threads') {
    return { success: false, error: info.error || 'URL Threads invalide', platform: 'threads' };
  }

  const canonical = info.canonicalUrl ?? validation.url.href;

  try {
    for (const endpoint of GENERIC_ENDPOINTS) {
      if (signal?.aborted) {
        return { success: false, error: 'Recherche annulée', platform: 'threads' };
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
            platform: 'threads',
          };
        }
      } catch {
        continue;
      }
    }

    const oembed = await fetchJson(
      `https://www.threads.net/oembed?url=${encodeURIComponent(canonical)}`,
      { signal }
    );
    const oembedItems = oembed ? parseOEmbedThumbnail(oembed) : [];
    if (oembedItems.length > 0) {
      return {
        success: true,
        mediaItems: oembedItems,
        mediaType: 'image',
        platform: 'threads',
      };
    }

    const proxyTarget = `https://corsproxy.io/?${encodeURIComponent(canonical)}`;
    const proxyCheck = validatePublicHttpUrl(proxyTarget);
    if (proxyCheck.ok) {
      const response = await fetchValidated(proxyCheck.url.href, {
        headers: { Accept: 'text/html,application/xhtml+xml' },
        signal,
      });
      if (response?.ok) {
        const html = await response.text();
        const mediaItems = parseOpenGraphMedia(html);
        if (mediaItems.length > 0) {
          return {
            success: true,
            mediaItems,
            mediaType: mediaItems[0].type,
            platform: 'threads',
          };
        }
      }
    }

    return {
      success: false,
      error:
        'Impossible de télécharger le média Threads. Le post est peut-être privé, supprimé, ou le compte n’est pas public.',
      platform: 'threads',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'threads' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Threads',
      platform: 'threads',
    };
  }
};
