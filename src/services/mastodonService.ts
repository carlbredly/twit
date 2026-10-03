import { extractMastodonStatusRef } from '../utils/linkDetector';
import { fetchValidated } from '../utils/http';
import { isAbortError, validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { parseMastodonStatus } from './mediaParsers';

function sameMastodonHost(expectedHost: string, actualHost: string): boolean {
  return expectedHost.toLowerCase().replace(/\.$/, '') === actualHost.toLowerCase().replace(/\.$/, '');
}

export const downloadMastodonMedia = async (
  url: string,
  signal?: AbortSignal
): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url, { httpsOnly: true });
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'mastodon' };
  }

  const ref = extractMastodonStatusRef(validation.url.href);
  if (!ref) {
    return { success: false, error: 'URL Mastodon invalide', platform: 'mastodon' };
  }

  const apiUrl = `${ref.origin}/api/v1/statuses/${encodeURIComponent(ref.statusId)}`;
  const apiCheck = validatePublicHttpUrl(apiUrl, { httpsOnly: true });
  if (!apiCheck.ok || !sameMastodonHost(ref.host, apiCheck.url.hostname)) {
    return { success: false, error: 'Hôte Mastodon non autorisé', platform: 'mastodon' };
  }

  try {
    const response = await fetchValidated(
      apiCheck.url.href,
      {
        headers: { Accept: 'application/json' },
        signal,
      },
      { httpsOnly: true }
    );

    if (!response?.ok) {
      return {
        success: false,
        error:
          'Impossible de télécharger le média Mastodon. Le statut est peut-être privé, sans média, ou supprimé.',
        platform: 'mastodon',
      };
    }

    const finalUrl = validatePublicHttpUrl(response.url, { httpsOnly: true });
    if (!finalUrl.ok || !sameMastodonHost(ref.host, finalUrl.url.hostname)) {
      return {
        success: false,
        error: 'Redirection vers un hôte non autorisé',
        platform: 'mastodon',
      };
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        error: 'Réponse Mastodon invalide',
        platform: 'mastodon',
      };
    }

    const mediaItems = parseMastodonStatus(data);
    if (mediaItems.length > 0) {
      return {
        success: true,
        mediaItems,
        mediaType: mediaItems[0].type,
        platform: 'mastodon',
      };
    }

    return {
      success: false,
      error:
        'Impossible de télécharger le média Mastodon. Le statut est peut-être privé, sans média, ou supprimé.',
      platform: 'mastodon',
    };
  } catch (error) {
    if (isAbortError(error)) {
      return { success: false, error: 'Recherche annulée', platform: 'mastodon' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Mastodon',
      platform: 'mastodon',
    };
  }
};
