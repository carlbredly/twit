import { detectPlatform } from '../utils/linkDetector';
import { validatePublicHttpUrl } from '../utils/security';
import type { DownloadResponse } from '../types/media';
import { toSafeMediaUrl } from './mediaParsers';

export const downloadSnapchatMedia = async (url: string): Promise<DownloadResponse> => {
  const validation = validatePublicHttpUrl(url);
  if (!validation.ok) {
    return { success: false, error: validation.error, platform: 'snapchat' };
  }

  const info = detectPlatform(validation.url.href);
  if (!info.isValid || info.platform !== 'snapchat') {
    return { success: false, error: 'URL Snapchat invalide', platform: 'snapchat' };
  }

  try {
    const proxyTarget = `https://corsproxy.io/?${encodeURIComponent(validation.url.href)}`;
    const proxyCheck = validatePublicHttpUrl(proxyTarget);
    if (!proxyCheck.ok) {
      return { success: false, error: 'Proxy Snapchat invalide', platform: 'snapchat' };
    }

    const response = await fetch(proxyCheck.url.href, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    if (response.ok) {
      const html = await response.text();
      const extracted = extractPublicMediaFromHtml(html);
      if (extracted) {
        return {
          success: true,
          mediaItems: [extracted],
          mediaType: extracted.type,
          platform: 'snapchat',
        };
      }
    }

    return {
      success: false,
      error:
        'Les snaps Snapchat sont généralement privés et nécessitent une authentification. Seuls les contenus publics peuvent être téléchargés.',
      platform: 'snapchat',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Snapchat',
      platform: 'snapchat',
    };
  }
};

export function extractPublicMediaFromHtml(html: string) {
  if (typeof html !== 'string' || html.length > 2_000_000) return null;

  const videoMatch =
    html.match(/"contentUrl"\s*:\s*"(https:[^"]+\.mp4[^"]*)"/i) ||
    html.match(/"video_url"\s*:\s*"(https:[^"]+)"/i);
  const imageMatch =
    html.match(/"image"\s*:\s*"(https:[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
    html.match(/"image_url"\s*:\s*"(https:[^"]+)"/i);

  const videoUrl = videoMatch ? toSafeMediaUrl(unescapeJsonUrl(videoMatch[1])) : null;
  if (videoUrl) {
    return { url: videoUrl, type: 'video' as const };
  }

  const imageUrl = imageMatch ? toSafeMediaUrl(unescapeJsonUrl(imageMatch[1])) : null;
  if (imageUrl) {
    return { url: imageUrl, type: 'image' as const };
  }

  return null;
}

function unescapeJsonUrl(value: string): string {
  return value.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
}
