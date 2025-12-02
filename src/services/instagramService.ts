import type { DownloadResponse, MediaItem } from './downloadService';

export const downloadInstagramMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    // Extraire l'ID du post Instagram pour validation
    const postIdMatch = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?]+)/);
    if (!postIdMatch) {
      return { success: false, error: 'URL Instagram invalide' };
    }
    
    // Méthode 1: Utiliser savefrom.net API via proxy CORS
    try {
      const saveFromUrl = `https://api.saveig.app/api/ajaxSearch`;
      const formData = new FormData();
      formData.append('q', url);
      formData.append('t', 'media');
      formData.append('lang', 'fr');

      const response = await fetch(saveFromUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'ok' && data.items && data.items.length > 0) {
          const mediaItems: MediaItem[] = [];
          
          for (const item of data.items) {
            const mediaUrl = item.url || item.downloadUrl || item.video || item.image;
            if (!mediaUrl) continue;
            
            if (item.type === 'video' || mediaUrl.includes('.mp4') || item.video) {
              mediaItems.push({
                url: mediaUrl,
                type: 'video',
                thumbnail: item.thumbnail || item.image,
              });
            } else if (item.type === 'image' || mediaUrl.match(/\.(jpg|jpeg|png|webp)$/i) || item.image) {
              mediaItems.push({
                url: mediaUrl,
                type: 'image',
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
      }
    } catch (e) {
      // Continuer avec la méthode fallback
    }

    // Méthode 2: Utiliser instadownloader.com ou similaire
    return await downloadInstagramFallback(url);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Instagram',
    };
  }
};

const downloadInstagramFallback = async (url: string): Promise<DownloadResponse> => {
  try {
    // Méthode alternative: utiliser instadownloader.com ou similaire
    const apiUrl = `https://api.instagram.com/api/v1/media/info/?url=${encodeURIComponent(url)}`;
    
    // Utiliser un proxy CORS
    const proxyResponse = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`);
    
    if (proxyResponse.ok) {
      const proxyData = await proxyResponse.json();
      const data = JSON.parse(proxyData.contents);
      
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        const mediaItems: MediaItem[] = [];
        
        if (item.video_versions && item.video_versions.length > 0) {
          mediaItems.push({
            url: item.video_versions[0].url,
            type: 'video',
            thumbnail: item.image_versions2?.candidates?.[0]?.url,
          });
        } else if (item.image_versions2) {
          mediaItems.push({
            url: item.image_versions2.candidates[0].url,
            type: 'image',
          });
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

    // Dernière méthode: extraction directe via proxy
    return await extractInstagramMedia(url);
  } catch (error) {
    return {
      success: false,
      error: 'Impossible de télécharger le média Instagram. Veuillez vérifier que le lien est public.',
    };
  }
};

const extractInstagramMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    // Utiliser un service d'extraction
    const extractUrl = `https://www.instagram.com/api/v1/media/info/?url=${encodeURIComponent(url)}`;
    
    // Via proxy CORS
    const response = await fetch(`https://corsproxy.io/?${encodeURIComponent(extractUrl)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (response.ok) {
      const html = await response.text();
      
      // Extraire les URLs des médias depuis le HTML
      const videoMatch = html.match(/"video_url":"([^"]+)"/);
      const imageMatch = html.match(/"display_url":"([^"]+)"/);
      
      if (videoMatch) {
        const videoUrl = videoMatch[1].replace(/\\u0026/g, '&');
        return {
          success: true,
          mediaItems: [{
            url: videoUrl,
            type: 'video',
          }],
          mediaType: 'video',
        };
      } else if (imageMatch) {
        const imageUrl = imageMatch[1].replace(/\\u0026/g, '&');
        return {
          success: true,
          mediaItems: [{
            url: imageUrl,
            type: 'image',
          }],
          mediaType: 'image',
        };
      }
    }

    return {
      success: false,
      error: 'Impossible d\'extraire le média. Le post est peut-être privé ou le lien est invalide.',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Erreur lors de l\'extraction du média Instagram',
    };
  }
};

