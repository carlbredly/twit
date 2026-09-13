import type { DownloadResponse } from './downloadService';
import { isSafeHttpUrl, isSafeMediaUrl, normalizeInputUrl } from '../utils/security';

export const extractSnapchatToken = (url: string): string | null => {
  const normalized = normalizeInputUrl(url);
  if (!isSafeHttpUrl(normalized)) return null;
  const match = normalized.match(/snapchat\.com\/(?:t|spotlight|story)\/([A-Za-z0-9._-]+)/i);
  return match?.[1] ?? null;
};

const firstSafeHttpsUrl = (candidates: Array<string | undefined>): string | undefined => {
  return candidates.find((candidate) => candidate && isSafeMediaUrl(candidate));
};

export const downloadSnapchatMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    const token = extractSnapchatToken(url);
    if (!token) {
      return { success: false, error: 'URL Snapchat invalide. Utilisez un lien Spotlight, Story ou /t/ public.' };
    }

    const normalizedUrl = normalizeInputUrl(url);
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(normalizedUrl)}`;
    if (!isSafeHttpUrl(proxyUrl)) {
      return { success: false, error: 'Proxy de lecture non sûr' };
    }

    const response = await fetch(proxyUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });

    if (response.ok) {
      const html = await response.text();

      const videoMatch =
        html.match(/"contentUrl"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/i) ||
        html.match(/"video_url":"(https:[^"]+)"/) ||
        html.match(/<video[^>]+src=["'](https:[^"']+)["']/i);

      const imageMatch =
        html.match(/"image_url":"(https:[^"]+)"/) ||
        html.match(/<img[^>]+src=["'](https:[^"']+\.(?:jpg|jpeg|png|webp))["']/i);

      const videoUrl = firstSafeHttpsUrl([videoMatch?.[1]]);
      const imageUrl = firstSafeHttpsUrl([imageMatch?.[1]]);

      if (videoUrl) {
        return {
          success: true,
          mediaItems: [{ url: videoUrl, type: 'video', thumbnail: imageUrl }],
          mediaType: 'video',
        };
      }

      if (imageUrl) {
        return {
          success: true,
          mediaItems: [{ url: imageUrl, type: 'image' }],
          mediaType: 'image',
        };
      }
    }

    return {
      success: false,
      error: 'Les snaps Snapchat sont généralement privés. Seuls les contenus publics Spotlight/Story peuvent être extraits.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Snapchat',
    };
  }
};
