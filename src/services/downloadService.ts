import type { Platform, MediaType } from '../utils/linkDetector';
import { downloadInstagramMedia } from './instagramService';
import { downloadTwitterMedia } from './twitterService';
import { downloadSnapchatMedia } from './snapchatService';

export interface MediaItem {
  url: string;
  type: MediaType;
  thumbnail?: string;
}

export interface DownloadResponse {
  success: boolean;
  mediaItems?: MediaItem[];
  error?: string;
  platform?: Platform;
  mediaType?: MediaType;
}

export const downloadMedia = async (
  url: string,
  platform: Platform
): Promise<DownloadResponse> => {
  try {
    switch (platform) {
      case 'instagram':
        return await downloadInstagramMedia(url);
      case 'twitter':
        return await downloadTwitterMedia(url);
      case 'snapchat':
        return await downloadSnapchatMedia(url);
      default:
        return {
          success: false,
          error: 'Plateforme non supportée',
          platform,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      platform,
    };
  }
};

export const triggerDownload = async (mediaUrl: string, filename: string, type: MediaType = 'video') => {
  try {
    // Pour les URLs distantes, on doit d'abord les récupérer
    const response = await fetch(mediaUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    
    // Déterminer l'extension du fichier
    const extension = type === 'video' ? 'mp4' : type === 'gif' ? 'gif' : 'jpg';
    link.download = `${filename || 'media'}.${extension}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Nettoyer l'URL du blob après un délai
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (error) {
    // Fallback: téléchargement direct (peut ne pas fonctionner à cause de CORS)
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = filename || 'media';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

