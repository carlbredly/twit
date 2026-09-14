import { useEffect, useMemo, useRef, useState } from 'react';
import {
  detectPlatform,
  getPlatformColor,
  getPlatformIcon,
  getPlatformName,
  type MediaType,
  type Platform,
} from '../utils/linkDetector';
import {
  addHistoryEntry,
  clearHistory,
  exportHistoryJson,
  loadHistory,
  removeHistoryEntry,
  type HistoryEntry,
} from '../utils/history';
import { SEARCH_RATE_LIMIT, SEARCH_RATE_WINDOW_MS, createRateLimiter } from '../utils/rateLimit';
import { applyTheme, readStoredTheme, toggleTheme, type Theme } from '../utils/theme';
import {
  availableMediaFilters,
  filterMediaItems,
  getMediaTypeIcon,
  getMediaTypeName,
} from '../utils/mediaHelpers';
import { readUrlQueryParam } from '../utils/query';
import { downloadMedia, triggerDownload, type MediaItem } from '../services/downloadService';
import type { MediaFilter } from '../types/media';

const formatRetry = (ms: number): string => `${Math.max(1, Math.ceil(ms / 1000))}s`;

export const VideoDownloader = () => {
  const [url, setUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState<ReturnType<typeof detectPlatform> | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [theme, setTheme] = useState<Theme>('light');
  const [copied, setCopied] = useState(false);
  const [copiedMediaIndex, setCopiedMediaIndex] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<MediaFilter>('all');
  const rateLimitRef = useRef(createRateLimiter(SEARCH_RATE_LIMIT, SEARCH_RATE_WINDOW_MS));

  useEffect(() => {
    const stored = readStoredTheme();
    applyTheme(stored);
    setTheme(stored);
    setHistory(loadHistory());

    const fromQuery = readUrlQueryParam(window.location.search);
    if (fromQuery) {
      setUrl(fromQuery);
      setLinkInfo(detectPlatform(fromQuery));
    }
  }, []);

  const analyzeUrl = (value: string) => {
    setUrl(value);
    setError(null);
    setMediaItems([]);
    setCopied(false);
    setTypeFilter('all');

    if (value.trim()) {
      setLinkInfo(detectPlatform(value));
    } else {
      setLinkInfo(null);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    analyzeUrl(e.target.value);
  };

  const handleDownload = async (sourceUrl = url) => {
    const info = detectPlatform(sourceUrl);
    setLinkInfo(info);

    if (!info.isValid || !sourceUrl.trim()) {
      setError(info.error || 'Veuillez entrer un lien valide');
      return;
    }

    const limit = rateLimitRef.current();
    if (!limit.allowed) {
      setError(`Trop de recherches. Réessayez dans ${formatRetry(limit.retryAfterMs)}.`);
      return;
    }

    setIsDownloading(true);
    setError(null);
    setMediaItems([]);
    setTypeFilter('all');
    setUrl(sourceUrl);

    try {
      const result = await downloadMedia(info.canonicalUrl || sourceUrl, info.platform);

      if (result.success && result.mediaItems && result.mediaItems.length > 0) {
        setMediaItems(result.mediaItems);
        setHistory(addHistoryEntry(info.canonicalUrl || sourceUrl, info.platform, result.mediaItems.length));
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
      setError(
        info.platform === 'instagram'
          ? `Erreur Instagram: ${errorMessage}. Essayez avec un autre lien ou vérifiez que le compte est public.`
          : errorMessage
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadItem = async (item: MediaItem, index: number) => {
    setDownloadingIndex(index);
    try {
      const platform = linkInfo?.platform ?? 'media';
      const filename = `${platform}-${Date.now()}-${index + 1}`;
      await triggerDownload(item.url, filename, item.type);
    } catch (err) {
      setError(`Erreur lors du téléchargement: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleDownloadAll = async () => {
    if (visibleItems.length === 0) return;
    setIsDownloadingAll(true);
    try {
      for (const [index, item] of visibleItems.entries()) {
        await handleDownloadItem(item, index);
      }
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      analyzeUrl(text);
    } catch {
      setError('Impossible de lire le presse-papiers. Collez le lien manuellement.');
    }
  };

  const handleCopy = async () => {
    if (!url.trim()) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Impossible de copier le lien.');
    }
  };

  const handleCopyMedia = async (item: MediaItem, index: number) => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopiedMediaIndex(index);
      window.setTimeout(() => setCopiedMediaIndex(null), 1500);
    } catch {
      setError('Impossible de copier l’URL du média.');
    }
  };

  const handleExportHistory = () => {
    const blob = new Blob([exportHistoryJson(history)], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'twit-historique.json';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  };

  const visibleItems = useMemo(
    () => filterMediaItems(mediaItems, typeFilter),
    [mediaItems, typeFilter]
  );
  const filters = useMemo(() => availableMediaFilters(mediaItems), [mediaItems]);

  const supportedPlatforms = useMemo(
    () =>
      [
        { id: 'instagram' as Platform, title: 'Instagram', detail: 'Vidéos, Images, Reels' },
        { id: 'twitter' as Platform, title: 'Twitter/X', detail: 'Vidéos, Images, GIFs' },
        { id: 'snapchat' as Platform, title: 'Snapchat', detail: 'Stories publiques' },
        { id: 'tiktok' as Platform, title: 'TikTok', detail: 'Vidéos et photos' },
      ] as const,
    []
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="text-left sm:text-center space-y-2 flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Téléchargeur de Médias
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
              Téléchargez des vidéos, images et GIFs depuis Instagram, Twitter/X, Snapchat ou TikTok
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(toggleTheme(theme))}
            className="shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
          >
            {theme === 'dark' ? '☀️ Clair' : '🌙 Sombre'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="media-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Lien du média
            </label>
            <div className="relative">
              <input
                id="media-url"
                type="text"
                value={url}
                onChange={handleUrlChange}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleDownload();
                  }
                }}
                placeholder="https://www.instagram.com/reel/... ou https://www.tiktok.com/@user/video/..."
                className="w-full px-4 py-4 pr-12 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm sm:text-base"
                autoComplete="off"
                spellCheck={false}
              />
              {linkInfo && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl" aria-hidden="true">
                  {getPlatformIcon(linkInfo.platform)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handlePaste()}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Coller
            </button>
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!url.trim()}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {copied ? 'Copié' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={() => analyzeUrl('')}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Effacer
            </button>
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
                  : linkInfo.error || 'Lien non reconnu'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!linkInfo?.isValid || isDownloading}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:shadow-none"
          >
            {isDownloading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3" role="alert">
              <p className="text-red-600 dark:text-red-400 text-sm sm:text-base text-center whitespace-pre-line">{error}</p>
              {linkInfo?.isValid && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void handleDownload()}
                    className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </div>
          )}

          {mediaItems.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Médias trouvés ({visibleItems.length}/{mediaItems.length})
                </h3>
                {visibleItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => void handleDownloadAll()}
                    disabled={isDownloadingAll || downloadingIndex !== null}
                    className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium disabled:opacity-50"
                  >
                    {isDownloadingAll ? 'Téléchargement…' : 'Tout télécharger'}
                  </button>
                )}
              </div>

              {filters.length > 2 && (
                <div className="flex flex-wrap gap-2" aria-label="Filtrer par type">
                  {filters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTypeFilter(filter)}
                      className={`px-3 py-1.5 rounded-full text-sm border ${
                        typeFilter === filter
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {filter === 'all' ? 'Tous' : getMediaTypeName(filter as MediaType)}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visibleItems.map((item, index) => (
                  <div
                    key={`${item.url}-${index}`}
                    className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-3 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="relative aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt=""
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

                    <button
                      type="button"
                      onClick={() => void handleDownloadItem(item, index)}
                      disabled={downloadingIndex === index}
                      className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                    >
                      {downloadingIndex === index ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
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
                    <button
                      type="button"
                      onClick={() => void handleCopyMedia(item, index)}
                      className="w-full py-2 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {copiedMediaIndex === index ? 'URL copiée' : 'Copier l’URL'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <section className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3" aria-label="Historique des recherches">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Historique</h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleExportHistory}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Exporter
                </button>
                <button
                  type="button"
                  onClick={() => setHistory(clearHistory())}
                  className="text-sm text-red-600 hover:underline"
                >
                  Vider
                </button>
              </div>
            </div>
            <ul className="space-y-2">
              {history.map((entry) => (
                <li key={entry.id} className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownload(entry.url)}
                    className="flex-1 text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-blue-400"
                  >
                    <span className="mr-2">{getPlatformIcon(entry.platform)}</span>
                    <span className="text-sm text-gray-700 dark:text-gray-200 break-all">{entry.url}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistory(removeHistoryEntry(entry.id))}
                    className="px-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-500 hover:text-red-600"
                    aria-label="Supprimer de l’historique"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {supportedPlatforms.map((platform) => (
            <div key={platform.id} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">{getPlatformIcon(platform.id)}</div>
              <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">{platform.title}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{platform.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
