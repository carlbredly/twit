import { useEffect, useState } from 'react';
import {
  detectPlatform,
  getPlatformIcon,
  getPlatformName,
  getPlatformColor,
  type Platform,
} from '../utils/linkDetector';
import { downloadMedia, triggerDownload, type MediaItem } from '../services/downloadService';
import { getMediaTypeIcon, getMediaTypeName } from '../utils/mediaHelpers';
import { clearHistory, loadHistory, saveHistoryEntry, type HistoryEntry } from '../utils/history';

const THEME_KEY = 'twit.theme';

const readTheme = (): 'light' | 'dark' => {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const VideoDownloader = () => {
  const [url, setUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState<ReturnType<typeof detectPlatform> | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof window === 'undefined' ? 'light' : readTheme()
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const applyUrl = (inputUrl: string) => {
    setUrl(inputUrl);
    setError(null);
    setMediaItems([]);

    if (inputUrl.trim()) {
      const info = detectPlatform(inputUrl);
      setLinkInfo(info);
      if (info.reason && !info.isValid) {
        setError(info.reason);
      }
    } else {
      setLinkInfo(null);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyUrl(e.target.value);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyUrl(text);
    } catch {
      setError('Impossible de lire le presse-papiers. Collez le lien manuellement.');
    }
  };

  const handleDownload = async (sourceUrl = url) => {
    const info = detectPlatform(sourceUrl);
    setLinkInfo(info);

    if (!info.isValid || !sourceUrl.trim()) {
      setError(info.reason || 'Veuillez entrer un lien valide');
      return;
    }

    setIsDownloading(true);
    setError(null);
    setMediaItems([]);

    try {
      const result = await downloadMedia(sourceUrl, info.platform);

      if (result.success && result.mediaItems && result.mediaItems.length > 0) {
        setMediaItems(result.mediaItems);
        setHistory(saveHistoryEntry({
          url: sourceUrl.trim(),
          platform: info.platform,
          mediaCount: result.mediaItems.length,
        }));
      } else if (info.platform === 'instagram') {
        setError(
          result.error ||
            'Impossible de télécharger le média Instagram.\n• Le compte est public\n• Le lien est correct\n• Le post n’est pas supprimé'
        );
      } else {
        setError(result.error || 'Aucun média trouvé. Le contenu est peut-être privé ou le lien est invalide.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(info.platform === 'instagram' ? `Erreur Instagram: ${errorMessage}` : errorMessage);
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

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      for (const [index, item] of mediaItems.entries()) {
        setDownloadingIndex(index);
        await triggerDownload(item.url, `media-${Date.now()}-${index}`, item.type);
      }
    } catch (err) {
      setError(`Erreur lors du téléchargement groupé: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setDownloadingIndex(null);
      setIsDownloadingAll(false);
    }
  };

  const handleCopy = async (item: MediaItem, index: number) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      setError('Impossible de copier le lien.');
    }
  };

  const platforms: Platform[] = ['instagram', 'twitter', 'tiktok', 'snapchat'];

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label="Changer le thème"
          >
            {theme === 'dark' ? '☀️ Clair' : '🌙 Sombre'}
          </button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Téléchargeur de Médias
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            Téléchargez des vidéos, images et GIFs depuis Instagram, Twitter/X, TikTok ou Snapchat
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={handleUrlChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleDownload();
                }
              }}
              placeholder="https://instagram.com/p/... ou https://www.tiktok.com/@.../video/..."
              className="w-full px-4 py-4 pr-28 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm sm:text-base"
              aria-label="Lien du média"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {url && (
                <button
                  type="button"
                  onClick={() => applyUrl('')}
                  className="text-xs px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => void handlePaste()}
                className="text-xs px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Coller
              </button>
              {linkInfo && <span className="text-xl">{getPlatformIcon(linkInfo.platform)}</span>}
            </div>
          </div>

          {linkInfo && (
            <div
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-semibold text-sm sm:text-base ${
                linkInfo.isValid ? getPlatformColor(linkInfo.platform) : 'bg-red-500'
              }`}
            >
              <span className="text-xl">{getPlatformIcon(linkInfo.platform)}</span>
              <span>
                {linkInfo.isValid
                  ? `${getPlatformName(linkInfo.platform)} détecté`
                  : linkInfo.reason || 'Lien non reconnu'}
              </span>
            </div>
          )}

          <button
            onClick={() => void handleDownload()}
            disabled={!linkInfo?.isValid || isDownloading}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:shadow-none"
          >
            {isDownloading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Recherche en cours...
              </span>
            ) : (
              'Rechercher et télécharger'
            )}
          </button>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-red-600 dark:text-red-400 text-sm sm:text-base text-center whitespace-pre-line">
                {error}
              </p>
            </div>
          )}

          {mediaItems.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Médias trouvés ({mediaItems.length})
                </h3>
                {mediaItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadAll()}
                    disabled={isDownloadingAll}
                    className="text-sm px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 disabled:opacity-50"
                  >
                    {isDownloadingAll ? 'Téléchargement…' : 'Tout télécharger'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mediaItems.map((item, index) => (
                  <div
                    key={`${item.url}-${index}`}
                    className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="relative aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={`Aperçu ${index + 1}`}
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

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void handleDownloadItem(item, index)}
                        disabled={downloadingIndex === index}
                        className="py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                      >
                        {downloadingIndex === index ? 'Téléchargement...' : `Télécharger`}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy(item, index)}
                        className="py-2.5 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200"
                      >
                        {copiedIndex === index ? 'Copié' : 'Copier le lien'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Historique local</h3>
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    setHistory([]);
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Vider
                </button>
              </div>
              <ul className="space-y-2">
                {history.slice(0, 8).map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => {
                        applyUrl(entry.url);
                        void handleDownload(entry.url);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-700 dark:text-gray-300 truncate"
                    >
                      {getPlatformIcon(entry.platform)} {entry.url}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {platforms.map((platform) => (
            <div key={platform} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">{getPlatformIcon(platform)}</div>
              <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">
                {getPlatformName(platform)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {platform === 'instagram' && 'Posts, Reels, IGTV'}
                {platform === 'twitter' && 'Vidéos, Images, GIFs'}
                {platform === 'tiktok' && 'Vidéos publiques'}
                {platform === 'snapchat' && 'Spotlight / Story'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
