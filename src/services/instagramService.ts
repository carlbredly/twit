import type { DownloadResponse, MediaItem } from './downloadService';
import { isSafeHttpUrl, isSafeMediaUrl, normalizeInputUrl } from '../utils/security';
import type { MediaType } from '../utils/linkDetector';

interface AjaxMediaItem {
  url?: string;
  downloadUrl?: string;
  video?: string;
  image?: string;
  media?: string;
  thumbnail?: string;
  type?: string;
  media_type?: string;
  mediaType?: string;
}

interface AjaxSearchResponse {
  status?: string;
  items?: AjaxMediaItem[];
}

const INSTAGRAM_AJAX_ENDPOINTS = [
  'https://instadownloader.org/api/ajaxSearch',
  'https://api.saveig.app/api/ajaxSearch',
  'https://saveig.app/api/ajaxSearch',
];

export const extractInstagramShortcode = (url: string): string | null => {
  const normalized = normalizeInputUrl(url);
  if (!isSafeHttpUrl(normalized)) return null;
  const match = normalized.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
};

const inferMediaType = (item: AjaxMediaItem, mediaUrl: string): Exclude<MediaType, 'unknown'> => {
  if (
    item.type === 'video' ||
    item.media_type === 'video' ||
    item.mediaType === 'video' ||
    Boolean(item.video) ||
    mediaUrl.includes('.mp4')
  ) {
    return 'video';
  }
  return 'image';
};

const mapAjaxItems = (items: AjaxMediaItem[]): MediaItem[] => {
  const mediaItems: MediaItem[] = [];

  for (const item of items) {
    const mediaUrl = item.url || item.downloadUrl || item.video || item.image || item.media;
    if (!mediaUrl || !isSafeMediaUrl(mediaUrl)) continue;

    const mediaType = inferMediaType(item, mediaUrl);
    const thumbnail = item.thumbnail || item.image || (mediaType === 'video' ? undefined : mediaUrl);

    mediaItems.push({
      url: mediaUrl,
      type: mediaType,
      thumbnail: thumbnail && isSafeMediaUrl(thumbnail) ? thumbnail : undefined,
    });
  }

  return mediaItems;
};

const tryAjaxEndpoint = async (endpoint: string, targetUrl: string): Promise<MediaItem[]> => {
  if (!isSafeHttpUrl(endpoint)) return [];

  const formData = new FormData();
  formData.append('q', targetUrl);
  formData.append('t', 'media');
  formData.append('lang', 'en');

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });

  if (!response.ok) return [];

  const data = (await response.json()) as AjaxSearchResponse;
  if (data.status !== 'ok' || !Array.isArray(data.items) || data.items.length === 0) {
    return [];
  }

  return mapAjaxItems(data.items);
};

const decodeEscapedUrl = (value: string): string =>
  value.replace(/\\u0026/g, '&').replace(/\\\//g, '/');

const collectUrlsFromHtml = (html: string, key: 'video_url' | 'display_url'): string[] => {
  const pattern = new RegExp(`"${key}":"([^"]+)"`, 'g');
  const found: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const candidate = decodeEscapedUrl(match[1]);
    if (isSafeMediaUrl(candidate)) {
      found.push(candidate);
    }
  }

  return found;
};

const extractInstagramFromPage = async (url: string): Promise<DownloadResponse> => {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  if (!isSafeHttpUrl(proxyUrl)) {
    return { success: false, error: 'Proxy de lecture non sûr' };
  }

  const response = await fetch(proxyUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });

  if (!response.ok) {
    return {
      success: false,
      error: 'Impossible de télécharger le média Instagram. Le post est peut-être privé, supprimé ou le lien est invalide.',
    };
  }

  const html = await response.text();
  if (!html) {
    return { success: false, error: 'Contenu HTML vide' };
  }

  const mediaItems: MediaItem[] = [];
  const videoUrls = collectUrlsFromHtml(html, 'video_url');
  const imageUrls = collectUrlsFromHtml(html, 'display_url');

  if (videoUrls[0]) {
    mediaItems.push({
      url: videoUrls[0],
      type: 'video',
      thumbnail: imageUrls[0],
    });
  } else if (imageUrls[0]) {
    mediaItems.push({ url: imageUrls[0], type: 'image' });
  }

  if (mediaItems.length > 0) {
    return { success: true, mediaItems, mediaType: mediaItems[0].type };
  }

  return {
    success: false,
    error: 'Impossible de télécharger le média Instagram. Le post est peut-être privé, supprimé ou le lien est invalide. Assurez-vous que le compte est public.',
  };
};

export const downloadInstagramMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    const normalizedUrl = normalizeInputUrl(url);
    if (!extractInstagramShortcode(normalizedUrl)) {
      return {
        success: false,
        error: 'URL Instagram invalide. Format attendu: instagram.com/p/... ou instagram.com/reel/...',
      };
    }

    for (const endpoint of INSTAGRAM_AJAX_ENDPOINTS) {
      try {
        const mediaItems = await tryAjaxEndpoint(endpoint, normalizedUrl);
        if (mediaItems.length > 0) {
          return { success: true, mediaItems, mediaType: mediaItems[0].type };
        }
      } catch {
        // Essayer l'endpoint suivant
      }
    }

    return await extractInstagramFromPage(normalizedUrl);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Instagram',
    };
  }
};
