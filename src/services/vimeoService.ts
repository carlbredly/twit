import { extractVimeoVideoRef } from '../utils/linkDetector';
import { fetchJson } from '../utils/http';
import { fetchViaMetaProxy } from '../utils/metaProxy';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseOEmbedThumbnail, parseVimeoPlayerConfig } from './mediaParsers';

async function fetchVimeoJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
  return (await fetchJson(url, { signal })) ?? (await fetchViaMetaProxy(url, signal));
}

function playerConfigUrl(id: string, hash?: string): string {
  const url = new URL(`https://player.vimeo.com/video/${encodeURIComponent(id)}/config`);
  if (hash) url.searchParams.set('h', hash);
  return url.href;
}

export const downloadVimeoMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url, { httpsOnly: true });
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'vimeo' };
  }

  const ref = extractVimeoVideoRef(validation.url.href);
  if (!ref) {
    return { success: false, error: 'URL Vimeo invalide', platform: 'vimeo' };
  }

  try {
    const config = await fetchVimeoJson(playerConfigUrl(ref.id, ref.hash), signal);
    const fromConfig = config ? parseVimeoPlayerConfig(config) : [];
    if (fromConfig.length > 0) {
      return {
        success: true,
        mediaItems: fromConfig,
        mediaType: fromConfig[0].type,
        platform: 'vimeo',
      };
    }

    const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(
      `https://vimeo.com/${ref.id}`
    )}`;
    const oembed = await fetchVimeoJson(oembedUrl, signal);
    const thumbnails = oembed ? parseOEmbedThumbnail(oembed) : [];
    if (thumbnails.length > 0) {
      return {
        success: true,
        mediaItems: thumbnails,
        mediaType: 'image',
        platform: 'vimeo',
      };
    }

    return {
      success: false,
      error:
        'Impossible de télécharger le média Vimeo. La vidéo est peut-être privée, restreinte ou supprimée.',
      platform: 'vimeo',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'vimeo' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Vimeo',
      platform: 'vimeo',
    };
  }
};
