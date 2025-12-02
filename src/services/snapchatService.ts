import type { DownloadResponse } from './downloadService';

export const downloadSnapchatMedia = async (url: string): Promise<DownloadResponse> => {
  try {
    // Snapchat est plus complexe car les liens sont souvent temporaires
    // Extraire l'identifiant du snap
    const snapMatch = url.match(/snapchat\.com\/.*\/([^/?]+)/);
    
    if (!snapMatch) {
      return { success: false, error: 'URL Snapchat invalide' };
    }

    // Les snaps Snapchat sont généralement privés et nécessitent une authentification
    // Pour les stories publiques, on peut essayer d'extraire via proxy
    
    // Méthode 1: Essayer d'accéder via proxy CORS
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (response.ok) {
      const html = await response.text();
      
      // Essayer d'extraire les URLs de médias depuis le HTML
      const videoMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i) || 
                          html.match(/"video_url":"([^"]+)"/) ||
                          html.match(/videoUrl["']?\s*[:=]\s*["']([^"']+)["']/i);
      
      const imageMatch = html.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|webp))["']/i) ||
                         html.match(/"image_url":"([^"]+)"/) ||
                         html.match(/imageUrl["']?\s*[:=]\s*["']([^"']+)["']/i);

      if (videoMatch) {
        const videoUrl = videoMatch[1];
        return {
          success: true,
          mediaItems: [{
            url: videoUrl,
            type: 'video',
          }],
          mediaType: 'video',
        };
      } else if (imageMatch) {
        const imageUrl = imageMatch[1];
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

    // Méthode 2: Utiliser l'API Snapchat si disponible (nécessite souvent authentification)
    return {
      success: false,
      error: 'Les snaps Snapchat sont généralement privés et nécessitent une authentification. Seuls les contenus publics peuvent être téléchargés.',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors du téléchargement Snapchat',
    };
  }
};

