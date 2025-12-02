import type { Platform } from '../utils/linkDetector';

export interface DownloadResponse {
  success: boolean;
  videoUrl?: string;
  error?: string;
  platform?: Platform;
}

// Note: Pour une application réelle, vous devrez utiliser une API backend
// car les plateformes ont des protections CORS. Cette fonction est un exemple.
export const downloadVideo = async (
  url: string,
  platform: Platform
): Promise<DownloadResponse> => {
  try {
    // Exemple d'implémentation - À remplacer par votre API backend
    // const response = await fetch('https://votre-api.com/download', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ url, platform }),
    // });
    // const data = await response.json();
    // return data;

    // Simulation pour la démo
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          videoUrl: url, // Dans une vraie app, ce serait l'URL de la vidéo téléchargée
          platform,
        });
      }, 2000);
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      platform,
    };
  }
};

export const triggerDownload = (videoUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = videoUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

