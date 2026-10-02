import { detectPlatform, extractPinterestPinId } from '../utils/linkDetector';
import { fetchJson, fetchValidated } from '../utils/http';
import { fetchViaMetaProxy } from '../utils/metaProxy';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import {
  parseOpenGraphMedia,
  parsePinterestOEmbed,
  parsePinterestPidget,
} from './mediaParsers';

async function fetchPinterestJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
  return (await fetchJson(url, { signal })) ?? (await fetchViaMetaProxy(url, signal));
}

function pidgetUrl(pinId: string): string {
  return `https://api.pinterest.com/v3/pidgets/pins/info/?pin_ids=${encodeURIComponent(pinId)}`;
}

function oembedUrl(canonical: string): string {
  return `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonical)}`;
}

export const downloadPinterestMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'pinterest' };
  }

  const info = detectPlatform(validation.url.href);
  if (!info.isValid || info.platform !== 'pinterest') {
    return { success: false, error: info.error || 'URL Pinterest invalide', platform: 'pinterest' };
  }

  const canonical = info.canonicalUrl ?? validation.url.href;
  const pinId = extractPinterestPinId(canonical);

  try {
    if (pinId && /^\d+$/.test(pinId)) {
      const pidget = await fetchPinterestJson(pidgetUrl(pinId), signal);
      const fromPidget = pidget ? parsePinterestPidget(pidget) : [];
      if (fromPidget.length > 0) {
        return {
          success: true,
          mediaItems: fromPidget,
          mediaType: fromPidget[0].type,
          platform: 'pinterest',
        };
      }
    }

    const oembed = await fetchPinterestJson(oembedUrl(canonical), signal);
    const fromOembed = oembed ? parsePinterestOEmbed(oembed) : [];
    if (fromOembed.length > 0) {
      return {
        success: true,
        mediaItems: fromOembed,
        mediaType: fromOembed[0].type,
        platform: 'pinterest',
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
            platform: 'pinterest',
          };
        }
      }
    }

    return {
      success: false,
      error:
        'Impossible de télécharger le média Pinterest. Le pin est peut-être privé, sans média, ou supprimé.',
      platform: 'pinterest',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'pinterest' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Pinterest',
      platform: 'pinterest',
    };
  }
};
