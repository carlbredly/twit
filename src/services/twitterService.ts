import type { DownloadResponse, MediaItem } from './downloadService';
import { isSafeHttpUrl, isSafeMediaUrl, normalizeInputUrl } from '../utils/security';

interface VideoVariant {
  content_type?: string;
  bitrate?: number;
  url?: string;
}

interface FxTwitterVideo {
  url?: string;
  video_url?: string;
  source?: { url?: string };
  thumbnail_url?: string;
  preview_image_url?: string;
}

interface FxTwitterPhoto {
  url?: string;
  media_url_https?: string;
}

interface FxTwitterGif {
  video_info?: { variants?: VideoVariant[] };
  media_url_https?: string;
  preview_image_url?: string;
}

interface FxTwitterPayload {
  tweet?: {
    media?: {
      videos?: FxTwitterVideo[];
      photos?: FxTwitterPhoto[];
      animated_gif?: FxTwitterGif[];
    };
  };
}

interface VxTwitterMedia {
  type?: string;
  url?: string;
  media_url_https?: string;
  video_info?: { variants?: VideoVariant[] };
}

const pickBestMp4 = (variants: VideoVariant[] | undefined): string | undefined => {
  if (!variants?.length) return undefined;
  const best = [...variants]
    .filter((variant) => variant.content_type === 'video/mp4' && variant.url && isSafeMediaUrl(variant.url))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  return best?.url;
};

export const extractTweetId = (url: string): string | null => {
  const normalized = normalizeInputUrl(url);
  if (!isSafeHttpUrl(normalized)) return null;
  const match = normalized.match(/(?:twitter\.com|x\.com)\/(?:[A-Za-z0-9_]+|i(?:\/web)?)\/status\/(\d+)/i);
  return match?.[1] ?? null;
};

const collectFxTwitterItems = (data: FxTwitterPayload): MediaItem[] => {
  const mediaItems: MediaItem[] = [];
  const media = data.tweet?.media;
  if (!media) return mediaItems;

  for (const item of media.videos || []) {
    const videoUrl = item.url || item.video_url || item.source?.url;
    if (videoUrl && isSafeMediaUrl(videoUrl)) {
      const thumbnail = item.thumbnail_url || item.preview_image_url;
      mediaItems.push({
        url: videoUrl,
        type: 'video',
        thumbnail: thumbnail && isSafeMediaUrl(thumbnail) ? thumbnail : undefined,
      });
    }
  }

  for (const item of media.photos || []) {
    const imageUrl = item.url || item.media_url_https;
    if (imageUrl && isSafeMediaUrl(imageUrl)) {
      mediaItems.push({ url: imageUrl, type: 'image' });
    }
  }

  for (const item of media.animated_gif || []) {
    const gifUrl = pickBestMp4(item.video_info?.variants);
    if (gifUrl) {
      const thumbnail = item.media_url_https || item.preview_image_url;
      mediaItems.push({
        url: gifUrl,
        type: 'gif',
        thumbnail: thumbnail && isSafeMediaUrl(thumbnail) ? thumbnail : undefined,
      });
    }
  }

  return mediaItems;
};

export const downloadTwitterMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    const tweetId = extractTweetId(url);
    if (!tweetId) {
      return { success: false, error: 'URL Twitter/X invalide' };
    }

    try {
      const response = await fetch(`https://api.fxtwitter.com/status/${tweetId}`, {
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });

      if (response.ok) {
        const data = (await response.json()) as FxTwitterPayload;
        const mediaItems = collectFxTwitterItems(data);
        if (mediaItems.length > 0) {
          return { success: true, mediaItems, mediaType: mediaItems[0].type };
        }
      }
    } catch {
      // Continuer avec la méthode de repli
    }

    return await downloadTwitterFallback(tweetId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Twitter/X',
    };
  }
};

const downloadTwitterFallback = async (tweetId: string): Promise<DownloadResponse> => {
  try {
    const response = await fetch(`https://api.vxtwitter.com/tweet/${tweetId}`, {
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'Impossible de télécharger le média Twitter/X. Le tweet est peut-être privé ou supprimé.',
      };
    }

    const data = (await response.json()) as { media?: VxTwitterMedia[] };
    const mediaItems: MediaItem[] = [];

    for (const media of data.media || []) {
      if (media.type === 'video') {
        const videoUrl = pickBestMp4(media.video_info?.variants);
        if (videoUrl) {
          mediaItems.push({
            url: videoUrl,
            type: 'video',
            thumbnail: media.media_url_https && isSafeMediaUrl(media.media_url_https) ? media.media_url_https : undefined,
          });
        }
      } else if (media.type === 'photo') {
        const imageUrl = media.media_url_https || media.url;
        if (imageUrl && isSafeMediaUrl(imageUrl)) {
          mediaItems.push({ url: imageUrl, type: 'image' });
        }
      } else if (media.type === 'animated_gif') {
        const gifUrl = pickBestMp4(media.video_info?.variants) || media.video_info?.variants?.[0]?.url;
        if (gifUrl && isSafeMediaUrl(gifUrl)) {
          mediaItems.push({
            url: gifUrl,
            type: 'gif',
            thumbnail: media.media_url_https && isSafeMediaUrl(media.media_url_https) ? media.media_url_https : undefined,
          });
        }
      }
    }

    if (mediaItems.length > 0) {
      return { success: true, mediaItems, mediaType: mediaItems[0].type };
    }

    return {
      success: false,
      error: 'Impossible de télécharger le média Twitter/X. Le tweet est peut-être privé ou supprimé.',
    };
  } catch {
    return {
      success: false,
      error: 'Erreur lors de l\'extraction du média Twitter/X',
    };
  }
};
