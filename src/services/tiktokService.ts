import type { DownloadResponse, MediaItem } from './downloadService';
import { isSafeHttpUrl, isSafeMediaUrl, normalizeInputUrl } from '../utils/security';

interface TikWmResponse {
  code?: number;
  msg?: string;
  data?: {
    play?: string;
    hdplay?: string;
    wmplay?: string;
    cover?: string;
    origin_cover?: string;
  };
}

export const extractTikTokId = (url: string): string | null => {
  const normalized = normalizeInputUrl(url);
  if (!isSafeHttpUrl(normalized)) return null;

  const videoMatch = normalized.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/i);
  if (videoMatch) return videoMatch[1];

  const shortMatch = normalized.match(/(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/i);
  if (shortMatch) return shortMatch[1];

  const tMatch = normalized.match(/tiktok\.com\/t\/([A-Za-z0-9]+)/i);
  return tMatch?.[1] ?? null;
};

export const downloadTikTokMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    const normalizedUrl = normalizeInputUrl(url);
    if (!extractTikTokId(normalizedUrl) && !/tiktok\.com/i.test(normalizedUrl)) {
      return { success: false, error: 'URL TikTok invalide' };
    }

    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(normalizedUrl)}&hd=1`;
    if (!isSafeHttpUrl(apiUrl)) {
      return { success: false, error: 'Endpoint TikTok non sûr' };
    }

    const response = await fetch(apiUrl, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });

    if (!response.ok) {
      return { success: false, error: 'Impossible de récupérer la vidéo TikTok.' };
    }

    const data = (await response.json()) as TikWmResponse;
    const playUrl = data.data?.hdplay || data.data?.play || data.data?.wmplay;
    const cover = data.data?.origin_cover || data.data?.cover;

    if (!playUrl || !isSafeMediaUrl(playUrl)) {
      return {
        success: false,
        error: data.msg || 'Aucun média TikTok public n’a été trouvé.',
      };
    }

    const mediaItems: MediaItem[] = [
      {
        url: playUrl,
        type: 'video',
        thumbnail: cover && isSafeMediaUrl(cover) ? cover : undefined,
      },
    ];

    return { success: true, mediaItems, mediaType: 'video' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement TikTok',
    };
  }
};
