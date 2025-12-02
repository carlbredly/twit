import { useState } from 'react';
import { detectPlatform, getPlatformIcon, getPlatformName, getPlatformColor, type Platform, type MediaType } from '../utils/linkDetector';
import { downloadMedia, triggerDownload, type MediaItem } from '../services/downloadService';

const getMediaTypeIcon = (type: MediaType): string => {
  switch (type) {
    case 'video':
      return '🎥';
    case 'image':
      return '🖼️';
    case 'gif':
      return '🎬';
    default:
      return '📎';
  }
};

const getMediaTypeName = (type: MediaType): string => {
  switch (type) {
    case 'video':
      return 'Vidéo';
    case 'image':
      return 'Image';
    case 'gif':
      return 'GIF';
    default:
      return 'Média';
  }
};

export const VideoDownloader = () => {
  const [url, setUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState<{ platform: Platform; isValid: boolean } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setError(null);
    setMediaItems([]);

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
    setMediaItems([]);

    try {
      const result = await downloadMedia(url, linkInfo.platform);
      
      if (result.success && result.mediaItems && result.mediaItems.length > 0) {
        setMediaItems(result.mediaItems);
      } else {
        setError(result.error || 'Aucun média trouvé. Le contenu est peut-être privé ou le lien est invalide.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadItem = async (item: MediaItem, index: number) => {
    setDownloadingIndex(index);
    try {
      const filename = `media-${Date.now()}-${index}`;
      await triggerDownload(item.url, filename, item.type);
    } catch (err) {
      setError(`Erreur lors du téléchargement: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setDownloadingIndex(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Téléchargeur de Médias
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            Téléchargez des vidéos, images et GIFs depuis Instagram, Twitter/X ou Snapchat
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://instagram.com/p/... ou https://twitter.com/.../status/..."
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
                Recherche en cours...
              </span>
            ) : (
              'Rechercher et télécharger'
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

          {/* Media Items Display */}
          {mediaItems.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Médias trouvés ({mediaItems.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mediaItems.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700"
                  >
                    {/* Media Preview */}
                    <div className="relative aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt={`Image ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-4xl">{getMediaTypeIcon(item.type)}</span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-semibold">
                        {getMediaTypeIcon(item.type)} {getMediaTypeName(item.type)}
                      </div>
                    </div>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownloadItem(item, index)}
                      disabled={downloadingIndex === index}
                      className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                    >
                      {downloadingIndex === index ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
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
                          Téléchargement...
                        </>
                      ) : (
                        <>
                          <span>⬇️</span>
                          Télécharger {getMediaTypeName(item.type)}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Platform Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">📷</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Instagram</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Vidéos, Images, Reels</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🐦</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Twitter/X</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Vidéos, Images, GIFs</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">👻</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Snapchat</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Stories publiques</div>
          </div>
        </div>
      </div>
    </div>
  );
};
