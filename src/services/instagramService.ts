import type { DownloadResponse, MediaItem } from './downloadService';

export const downloadInstagramMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    // Normaliser l'URL Instagram
    let normalizedUrl = url.trim();
    if (!normalizedUrl.includes('instagram.com')) {
      return { success: false, error: 'URL Instagram invalide' };
    }

    // Extraire l'ID du post Instagram pour validation
    const postIdMatch = normalizedUrl.match(/instagram\.com\/(?:p|reel|tv)\/([^/?]+)/);
    if (!postIdMatch) {
      return { success: false, error: 'URL Instagram invalide. Format attendu: instagram.com/p/... ou instagram.com/reel/...' };
    }

    // Méthode 1: Utiliser instadownloader.org API (plus fiable et gratuit)
    try {
      const instaDownloaderUrl = `https://instadownloader.org/api/ajaxSearch`;
      const formData = new FormData();
      formData.append('q', normalizedUrl);
      formData.append('t', 'media');
      formData.append('lang', 'en');

      const response = await fetch(instaDownloaderUrl, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'ok' && data.items && Array.isArray(data.items) && data.items.length > 0) {
          const mediaItems: MediaItem[] = [];
          
          for (const item of data.items) {
            const mediaUrl = item.url || item.downloadUrl || item.video || item.image;
            if (!mediaUrl) continue;
            
            // Déterminer le type
            let mediaType: 'video' | 'image' = 'image';
            if (item.type === 'video' || 
                mediaUrl.includes('.mp4') || 
                item.video ||
                item.media_type === 'video' ||
                item.mediaType === 'video') {
              mediaType = 'video';
            }
            
            mediaItems.push({
              url: mediaUrl,
              type: mediaType,
              thumbnail: item.thumbnail || item.image || (mediaType === 'video' ? undefined : mediaUrl),
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
    } catch (e) {
      // Continuer avec la méthode suivante
    }

    // Méthode 2: Utiliser saveig.app avec une meilleure gestion
    try {
      const saveigUrl = `https://api.saveig.app/api/ajaxSearch`;
      const formData = new FormData();
      formData.append('q', normalizedUrl);
      formData.append('t', 'media');
      formData.append('lang', 'en');

      const response = await fetch(saveigUrl, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'ok' && data.items && Array.isArray(data.items) && data.items.length > 0) {
          const mediaItems: MediaItem[] = [];
          
          for (const item of data.items) {
            const mediaUrl = item.url || item.downloadUrl || item.video || item.image || item.media;
            if (!mediaUrl) continue;
            
            // Déterminer le type
            let mediaType: 'video' | 'image' = 'image';
            if (item.type === 'video' || 
                mediaUrl.includes('.mp4') || 
                item.video ||
                item.media_type === 'video' ||
                item.mediaType === 'video') {
              mediaType = 'video';
            }
            
            mediaItems.push({
              url: mediaUrl,
              type: mediaType,
              thumbnail: item.thumbnail || item.image || (mediaType === 'video' ? undefined : mediaUrl),
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
    } catch (e) {
      // Continuer avec la méthode suivante
    }

    // Méthode 3: Extraction directe depuis la page Instagram via proxy
    return await extractInstagramFromPage(normalizedUrl);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Instagram',
    };
  }
};

const extractInstagramFromPage = async (url: string): Promise<DownloadResponse> => {
  try {
    // Utiliser un proxy CORS pour accéder à la page Instagram
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (response.ok) {
      const proxyData = await response.json();
      const html = proxyData.contents;
      
      if (!html) {
        throw new Error('Contenu HTML vide');
      }

      const mediaItems: MediaItem[] = [];
      
      // Méthode 1: Extraire depuis window._sharedData (méthode la plus fiable)
      const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({.+?});/);
      if (sharedDataMatch) {
        try {
          const sharedData = JSON.parse(sharedDataMatch[1]);
          const postData = sharedData?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media ||
                          sharedData?.entry_data?.ReelPage?.[0]?.reel?.media;
          
          if (postData) {
            // Vidéo
            if (postData.video_url || (postData.video_versions && postData.video_versions.length > 0)) {
              const videoUrl = postData.video_url || postData.video_versions[0].url;
              mediaItems.push({
                url: videoUrl,
                type: 'video',
                thumbnail: postData.display_url || postData.thumbnail_src,
              });
            }
            // Image
            else if (postData.display_url || (postData.image_versions2 && postData.image_versions2.candidates)) {
              const imageUrl = postData.display_url || postData.image_versions2.candidates[0].url;
              mediaItems.push({
                url: imageUrl,
                type: 'image',
              });
            }
            // Carrousel
            else if (postData.edge_sidecar_to_children?.edges) {
              for (const edge of postData.edge_sidecar_to_children.edges) {
                const node = edge.node;
                if (node.video_url) {
                  mediaItems.push({
                    url: node.video_url,
                    type: 'video',
                    thumbnail: node.display_url,
                  });
                } else if (node.display_url) {
                  mediaItems.push({
                    url: node.display_url,
                    type: 'image',
                  });
                }
              }
            }
          }
        } catch (e) {
          // Continuer avec l'extraction regex
        }
      }

      // Méthode 2: Extraction via regex si window._sharedData n'a pas fonctionné
      if (mediaItems.length === 0) {
        // Chercher les URLs de vidéos
        const videoMatches = html.match(/"video_url":"([^"]+)"/g) || 
                            html.match(/"videoUrl":"([^"]+)"/g) ||
                            html.match(/video_url["']?\s*[:=]\s*["']([^"']+)["']/g);
        
        if (videoMatches) {
          for (const match of videoMatches) {
            const urlMatch = match.match(/"([^"]+)"/);
            if (urlMatch) {
              const videoUrl = urlMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
              if (videoUrl.startsWith('http')) {
                mediaItems.push({
                  url: videoUrl,
                  type: 'video',
                });
                break; // Prendre la première vidéo trouvée
              }
            }
          }
        }

        // Chercher les URLs d'images si pas de vidéo
        if (mediaItems.length === 0) {
          const imageMatches = html.match(/"display_url":"([^"]+)"/g) ||
                              html.match(/"imageUrl":"([^"]+)"/g) ||
                              html.match(/display_url["']?\s*[:=]\s*["']([^"']+)["']/g);
          
          if (imageMatches) {
            for (const match of imageMatches) {
              const urlMatch = match.match(/"([^"]+)"/);
              if (urlMatch) {
                const imageUrl = urlMatch[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
                if (imageUrl.startsWith('http')) {
                  mediaItems.push({
                    url: imageUrl,
                    type: 'image',
                  });
                  break; // Prendre la première image trouvée
                }
              }
            }
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

    // Méthode 4: Utiliser savefrom.net (dernière tentative)
    try {
      const saveFromUrl = `https://saveig.app/api/ajaxSearch`;
      const formData = new FormData();
      formData.append('q', url);
      formData.append('t', 'media');
      formData.append('lang', 'en');

      const response = await fetch(saveFromUrl, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'ok' && data.items && Array.isArray(data.items) && data.items.length > 0) {
          const mediaItems: MediaItem[] = [];
          
          for (const item of data.items) {
            const mediaUrl = item.url || item.downloadUrl || item.video || item.image;
            if (!mediaUrl) continue;
            
            const mediaType: 'video' | 'image' = 
              (item.type === 'video' || mediaUrl.includes('.mp4') || item.video) ? 'video' : 'image';
            
            mediaItems.push({
              url: mediaUrl,
              type: mediaType,
              thumbnail: item.thumbnail || (mediaType === 'image' ? mediaUrl : undefined),
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
    } catch (e) {
      // Ignorer cette erreur
    }

    return {
      success: false,
      error: 'Impossible de télécharger le média Instagram. Le post est peut-être privé, supprimé ou le lien est invalide. Assurez-vous que le compte est public.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'extraction du média Instagram',
    };
  }
};
