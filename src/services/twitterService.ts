import type { DownloadResponse, MediaItem } from './downloadService';
import type { MediaType } from '../utils/linkDetector';

const pickBestMp4Variant = (
  variants: Array<{ content_type?: string; bitrate?: number; url?: string }> | undefined
): string | null => {
  if (!variants?.length) return null;
  const best = [...variants]
    .filter((v) => v.content_type === 'video/mp4' && v.url)
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  return best?.url || variants.find((v) => v.url)?.url || null;
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

          // fxTwitter places videos AND animated GIFs under media.videos (type: "gif").
          for (const item of media.videos || []) {
            const videoUrl = item.url || item.video_url || item.source?.url;
            if (videoUrl) {
              mediaItems.push({
                url: videoUrl,
                type: mediaTypeFromFxVideo(item),
                thumbnail: item.thumbnail_url || item.preview_image_url,
              });
            }
          }

          for (const item of media.photos || []) {
            const imageUrl = item.url || item.media_url_https;
            if (imageUrl) {
              mediaItems.push({
                url: imageUrl,
                type: 'image',
              });
            }
          }

          for (const item of media.animated_gif || []) {
            const gifUrl =
              item.url ||
              pickBestMp4Variant(item.video_info?.variants) ||
              item.video_url;
            if (gifUrl) {
              mediaItems.push({
                url: gifUrl,
                type: 'gif',
                thumbnail: item.thumbnail_url || item.media_url_https || item.preview_image_url,
              });
            }
          }

          // Deduplicate by URL while preserving order
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
    // vxTwitter expects /{user}/status/{id}; "i" is a valid placeholder username.
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
            mediaItems.push({
              url: media.url,
              type: 'video',
              thumbnail: media.thumbnail_url || media.altText,
            });
          } else if (media.type === 'gif' || media.type === 'animated_gif') {
            mediaItems.push({
              url: media.url,
              type: 'gif',
              thumbnail: media.thumbnail_url,
            });
          } else if (media.type === 'image' || media.type === 'photo') {
            mediaItems.push({
              url: media.url,
              type: 'image',
            });
          }
        }
      }

      // Legacy / alternate shape
      if (mediaItems.length === 0 && Array.isArray(data.media)) {
        for (const media of data.media) {
          if (media.type === 'video') {
            const best = pickBestMp4Variant(media.video_info?.variants);
            if (best) {
              mediaItems.push({
                url: best,
                type: 'video',
                thumbnail: media.media_url_https,
              });
            }
          } else if (media.type === 'photo') {
            mediaItems.push({
              url: media.media_url_https || media.url,
              type: 'image',
            });
          } else if (media.type === 'animated_gif') {
            const best = pickBestMp4Variant(media.video_info?.variants);
            if (best) {
              mediaItems.push({
                url: best,
                type: 'gif',
                thumbnail: media.media_url_https,
              });
            }
          }
        }
      }

      // mediaURLs string list as last resort
      if (mediaItems.length === 0 && Array.isArray(data.mediaURLs)) {
        for (const mediaUrl of data.mediaURLs) {
          if (typeof mediaUrl !== 'string') continue;
          const lower = mediaUrl.toLowerCase();
          const type: MediaType = lower.includes('.mp4')
            ? 'video'
            : lower.includes('video.twimg.com')
              ? 'video'
              : 'image';
          mediaItems.push({ url: mediaUrl, type });
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
