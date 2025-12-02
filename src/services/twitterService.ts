import type { DownloadResponse, MediaItem } from './downloadService';

export const downloadTwitterMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    // Extraire l'ID du tweet
    const tweetIdMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!tweetIdMatch) {
      return { success: false, error: 'URL Twitter/X invalide' };
    }

    const tweetId = tweetIdMatch[1];
    
    // Méthode 1: Utiliser l'API fxTwitter (meilleure option)
    try {
      const apiUrl = `https://api.fxtwitter.com/status/${tweetId}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.tweet && data.tweet.media) {
          const mediaItems: MediaItem[] = [];
          
          // Vidéos
          for (const media of data.tweet.media.videos || []) {
            const videoUrl = media.url || media.video_url || media.source?.url;
            if (videoUrl) {
              mediaItems.push({
                url: videoUrl,
                type: 'video',
                thumbnail: media.thumbnail_url || media.preview_image_url,
              });
            }
          }
          
          // Images
          for (const media of data.tweet.media.photos || []) {
            const imageUrl = media.url || media.media_url_https;
            if (imageUrl) {
              mediaItems.push({
                url: imageUrl,
                type: 'image',
              });
            }
          }

          // GIFs animés
          for (const media of data.tweet.media.animated_gif || []) {
            if (media.video_info?.variants) {
              const bestQuality = media.video_info.variants
                .filter((v: any) => v.content_type === 'video/mp4')
                .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
              
              if (bestQuality) {
                mediaItems.push({
                  url: bestQuality.url,
                  type: 'gif',
                  thumbnail: media.media_url_https || media.preview_image_url,
                });
              }
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
      }
    } catch (e) {
      // Continuer avec la méthode fallback
    }

    // Méthode 2: Utiliser vxTwitter comme alternative
    return await downloadTwitterFallback(url, tweetId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Twitter/X',
    };
  }
};

const downloadTwitterFallback = async (_url: string, tweetId: string): Promise<DownloadResponse> => {
  try {
    // Méthode alternative: utiliser twdown ou extraction directe
    const extractUrl = `https://api.vxtwitter.com/tweet/${tweetId}`;
    
    const response = await fetch(extractUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.media) {
        const mediaItems: MediaItem[] = [];
        
        for (const media of data.media) {
          if (media.type === 'video') {
            // Trouver la meilleure qualité vidéo
            if (media.video_info && media.video_info.variants) {
              const bestVariant = media.video_info.variants
                .filter((v: any) => v.content_type === 'video/mp4')
                .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
              
              if (bestVariant) {
                mediaItems.push({
                  url: bestVariant.url,
                  type: 'video',
                  thumbnail: media.media_url_https,
                });
              }
            }
          } else if (media.type === 'photo') {
            mediaItems.push({
              url: media.media_url_https || media.url,
              type: 'image',
            });
          } else if (media.type === 'animated_gif') {
            if (media.video_info?.variants) {
              const bestVariant = media.video_info.variants[0];
              mediaItems.push({
                url: bestVariant.url,
                type: 'gif',
                thumbnail: media.media_url_https,
              });
            }
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
    }

    return {
      success: false,
      error: 'Impossible de télécharger le média Twitter/X. Le tweet est peut-être privé ou supprimé.',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Erreur lors de l\'extraction du média Twitter/X',
    };
  }
};

