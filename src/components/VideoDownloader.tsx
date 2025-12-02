import { useState } from 'react';
import { detectPlatform, getPlatformIcon, getPlatformName, getPlatformColor, type Platform } from '../utils/linkDetector';
import { downloadVideo } from '../services/downloadService';

export const VideoDownloader = () => {
  const [url, setUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState<{ platform: Platform; isValid: boolean } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setError(null);
    setSuccess(false);

    if (inputUrl.trim()) {
      const info = detectPlatform(inputUrl);
      setLinkInfo(info);
    } else {
      setLinkInfo(null);
    }
  };

  const handleDownload = async () => {
    if (!linkInfo?.isValid || !url.trim()) {
      setError('Veuillez entrer un lien valide');
      return;
    }

    setIsDownloading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await downloadVideo(url, linkInfo.platform);
      
      if (result.success && result.videoUrl) {
        setSuccess(true);
        // Dans une vraie application, vous utiliseriez result.videoUrl pour télécharger
        // triggerDownload(result.videoUrl, `video-${Date.now()}.mp4`);
        setTimeout(() => {
          setSuccess(false);
        }, 3000);
      } else {
        setError(result.error || 'Erreur lors du téléchargement');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Téléchargeur de Vidéos
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            Collez le lien d'une vidéo Instagram, Twitter/X ou Snapchat
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://instagram.com/p/..."
              className="w-full px-4 py-4 pr-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm sm:text-base"
            />
            {linkInfo && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl">
                {getPlatformIcon(linkInfo.platform)}
              </div>
            )}
          </div>

          {/* Platform Detection Badge */}
          {linkInfo && (
            <div
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-semibold text-sm sm:text-base ${
                linkInfo.isValid
                  ? getPlatformColor(linkInfo.platform)
                  : 'bg-red-500'
              }`}
            >
              <span className="text-xl">{getPlatformIcon(linkInfo.platform)}</span>
              <span>
                {linkInfo.isValid
                  ? `${getPlatformName(linkInfo.platform)} détecté`
                  : 'Lien non reconnu'}
              </span>
            </div>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={!linkInfo?.isValid || isDownloading}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:shadow-none"
          >
            {isDownloading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Téléchargement en cours...
              </span>
            ) : (
              'Télécharger la vidéo'
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-red-600 dark:text-red-400 text-sm sm:text-base text-center">
                {error}
              </p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-green-600 dark:text-green-400 text-sm sm:text-base text-center font-semibold">
                ✓ Vidéo téléchargée avec succès !
              </p>
            </div>
          )}
        </div>

        {/* Platform Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">📷</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Instagram</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🐦</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Twitter/X</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">👻</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Snapchat</div>
          </div>
        </div>
      </div>
    </div>
  );
};

