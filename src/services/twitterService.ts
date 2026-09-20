import type { DownloadResponse, MediaItem } from './downloadService';
import type { MediaType } from '../utils/linkDetector';

interface VideoVariant {
  url?: string;
  bitrate?: number;
  content_type?: string;
  width?: number;
  height?: number;
}

const parseResolutionFromUrl = (url: string): { width?: number; height?: number } => {
  const match = url.match(/\/(\d{2,4})x(\d{2,4})\//);
  if (!match) return {};
  return { width: Number(match[1]), height: Number(match[2]) };
};

const qualityTag = (width?: number, height?: number, bitrate?: number): string | undefined => {
  if (width && height) {
    // Twitter labels follow the short edge (720p, 360p, 180p).
    const shortEdge = Math.min(width, height);
    if (shortEdge >= 1080) return '1080p';
    if (shortEdge >= 720) return '720p';
    if (shortEdge >= 480) return '480p';
    if (shortEdge >= 360) return '360p';
    if (shortEdge >= 240) return '240p';
    return `${shortEdge}p`;
  }
  if (bitrate && bitrate >= 2_000_000) return '720p';
  if (bitrate && bitrate >= 800_000) return '360p';
  if (bitrate) return '240p';
  return undefined;
};

const qualityLabel = (
  type: MediaType,
  width?: number,
  height?: number,
  bitrate?: number
): string => {
  if (type === 'image') return 'Image originale';
  if (type === 'gif') {
    if (width && height) return `GIF ${width}×${height}`;
    return 'GIF';
  }
  const tag = qualityTag(width, height, bitrate);
  if (width && height) {
    const isHd = Math.max(width, height) >= 720;
    return isHd ? `${width}×${height} (HD)` : `${width}×${height}`;
  }
  if (tag) return tag;
  return 'Vidéo';
};

const mp4VariantsFromList = (variants: VideoVariant[] | undefined): VideoVariant[] => {
  if (!variants?.length) return [];
  return variants
    .filter((v) => v.url && (v.content_type === 'video/mp4' || v.url.includes('.mp4')))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
};

const mediaTypeFromFxVideo = (media: { type?: string }): MediaType => {
  return media.type === 'gif' || media.type === 'animated_gif' ? 'gif' : 'video';
};

export const downloadTwitterMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    const tweetIdMatch = url.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?\w+\/status\/(\d+)/);
    if (!tweetIdMatch) {
      return { success: false, error: 'URL Twitter/X invalide' };
    }

    const tweetId = tweetIdMatch[1];

    try {
      const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;
      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.tweet?.media) {
          const mediaItems: MediaItem[] = [];
          const media = data.tweet.media;

          for (const item of media.videos || []) {
            const type = mediaTypeFromFxVideo(item);
            const variants = mp4VariantsFromList(item.variants);

            if (variants.length > 0) {
              for (const variant of variants) {
                if (!variant.url) continue;
                const fromUrl = parseResolutionFromUrl(variant.url);
                const width = variant.width || fromUrl.width || item.width;
                const height = variant.height || fromUrl.height || item.height;
                mediaItems.push({
                  url: variant.url,
                  type,
                  thumbnail: item.thumbnail_url || item.preview_image_url,
                  width,
                  height,
                  bitrate: variant.bitrate,
                  quality: qualityTag(width, height, variant.bitrate),
                  label: qualityLabel(type, width, height, variant.bitrate),
                });
              }
            } else {
              // Also try fxTwitter "formats" list (mp4 containers) when variants are missing
              const formats = (item.formats || []) as Array<{
                url?: string;
                bitrate?: number;
                container?: string;
              }>;
              const mp4Formats = formats.filter(
                (f) => f.url && (f.container === 'mp4' || f.url.includes('.mp4'))
              );

              if (mp4Formats.length > 0) {
                const sorted = [...mp4Formats].sort(
                  (a, b) => (b.bitrate || 0) - (a.bitrate || 0)
                );
                for (const format of sorted) {
                  if (!format.url) continue;
                  const fromUrl = parseResolutionFromUrl(format.url);
                  const width = fromUrl.width || item.width;
                  const height = fromUrl.height || item.height;
                  mediaItems.push({
                    url: format.url,
                    type,
                    thumbnail: item.thumbnail_url || item.preview_image_url,
                    width,
                    height,
                    bitrate: format.bitrate,
                    quality: qualityTag(width, height, format.bitrate),
                    label: qualityLabel(type, width, height, format.bitrate),
                  });
                }
              } else {
                const videoUrl = item.url || item.video_url || item.source?.url;
                if (videoUrl) {
                  const fromUrl = parseResolutionFromUrl(videoUrl);
                  const width = item.width || fromUrl.width;
                  const height = item.height || fromUrl.height;
                  mediaItems.push({
                    url: videoUrl,
                    type,
                    thumbnail: item.thumbnail_url || item.preview_image_url,
                    width,
                    height,
                    quality: qualityTag(width, height),
                    label: qualityLabel(type, width, height),
                  });
                }
              }
            }
          }

          for (const item of media.photos || []) {
            const imageUrl = item.url || item.media_url_https;
            if (imageUrl) {
              mediaItems.push({
                url: imageUrl,
                type: 'image',
                quality: 'orig',
                label: qualityLabel('image'),
              });
            }
          }

          for (const item of media.animated_gif || []) {
            const variants = mp4VariantsFromList(item.video_info?.variants);
            const gifUrl = item.url || variants[0]?.url || item.video_url;
            if (gifUrl) {
              const fromUrl = parseResolutionFromUrl(gifUrl);
              mediaItems.push({
                url: gifUrl,
                type: 'gif',
                thumbnail: item.thumbnail_url || item.media_url_https || item.preview_image_url,
                width: fromUrl.width,
                height: fromUrl.height,
                quality: qualityTag(fromUrl.width, fromUrl.height),
                label: qualityLabel('gif', fromUrl.width, fromUrl.height),
              });
            }
          }

          const seen = new Set<string>();
          const unique = mediaItems.filter((m) => {
            if (seen.has(m.url)) return false;
            seen.add(m.url);
            return true;
          });

          if (unique.length > 0) {
            return {
              success: true,
              mediaItems: unique,
              mediaType: unique[0].type,
            };
          }
        }
      }
    } catch {
      // Continuer avec la méthode fallback
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
    const extractUrl = `https://api.vxtwitter.com/i/status/${tweetId}`;

    const response = await fetch(extractUrl, {
      headers: { Accept: 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      const mediaItems: MediaItem[] = [];

      const extended = data.media_extended || [];
      if (Array.isArray(extended) && extended.length > 0) {
        for (const media of extended) {
          if (!media?.url) continue;
          if (media.type === 'video') {
            const fromUrl = parseResolutionFromUrl(media.url);
            mediaItems.push({
              url: media.url,
              type: 'video',
              thumbnail: media.thumbnail_url,
              width: fromUrl.width,
              height: fromUrl.height,
              quality: qualityTag(fromUrl.width, fromUrl.height),
              label: qualityLabel('video', fromUrl.width, fromUrl.height),
            });
          } else if (media.type === 'gif' || media.type === 'animated_gif') {
            mediaItems.push({
              url: media.url,
              type: 'gif',
              thumbnail: media.thumbnail_url,
              label: qualityLabel('gif'),
            });
          } else if (media.type === 'image' || media.type === 'photo') {
            mediaItems.push({
              url: media.url,
              type: 'image',
              quality: 'orig',
              label: qualityLabel('image'),
            });
          }
        }
      }

      if (mediaItems.length === 0 && Array.isArray(data.mediaURLs)) {
        for (const mediaUrl of data.mediaURLs) {
          if (typeof mediaUrl !== 'string') continue;
          const lower = mediaUrl.toLowerCase();
          const type: MediaType =
            lower.includes('.mp4') || lower.includes('video.twimg.com') ? 'video' : 'image';
          const fromUrl = parseResolutionFromUrl(mediaUrl);
          mediaItems.push({
            url: mediaUrl,
            type,
            width: fromUrl.width,
            height: fromUrl.height,
            quality: qualityTag(fromUrl.width, fromUrl.height),
            label: qualityLabel(type, fromUrl.width, fromUrl.height),
          });
        }
      }

      if (mediaItems.length > 0) {
        return {
          success: true,
          mediaItems,
          mediaType: mediaItems[0].type,
        };
      }
    }

    return {
      success: false,
      error: 'Impossible de télécharger le média Twitter/X. Le tweet est peut-être privé ou supprimé.',
    };
  } catch {
    return {
      success: false,
      error: "Erreur lors de l'extraction du média Twitter/X",
    };
  }
};
