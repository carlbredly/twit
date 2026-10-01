import { useEffect, useMemo, useRef, useState } from 'react';
import {
  detectPlatform,
  getPlatformColor,
  getPlatformIcon,
  getPlatformName,
  type Platform,
} from '../utils/linkDetector';
import { downloadMedia, triggerDownload, type MediaItem } from '../services/downloadService';
import {
  addHistoryEntry,
  clearHistory,
  exportHistoryCsv,
  exportHistoryJson,
  filterHistoryEntries,
  importHistoryJson,
  loadHistory,
  removeHistoryEntry,
  type HistoryEntry,
} from '../utils/history';
import {
  availableMediaFilters,
  filterMediaItems,
  getMediaTypeIcon,
  getMediaTypeName,
  groupMediaItems,
  sizeOptionLabel,
} from '../utils/mediaHelpers';
import { readUrlQueryParam } from '../utils/query';
import { createRateLimiter, SEARCH_RATE_LIMIT, SEARCH_RATE_WINDOW_MS } from '../utils/rateLimit';
import { buildShareUrl } from '../utils/share';
import { applyTheme, readStoredTheme, toggleTheme, type Theme } from '../utils/theme';
import { readClipboardText, writeClipboardText } from '../utils/clipboard';
import { extractDroppedUrl, extractInputUrl } from '../utils/dropUrl';
import { sanitizeFilename } from '../utils/security';
import { isCancelHotkey, isSearchHotkey } from '../utils/keyboard';
import type { MediaFilter } from '../types/media';

export const VideoDownloader = () => {
  const [url, setUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState<ReturnType<typeof detectPlatform> | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [selectedByGroup, setSelectedByGroup] = useState<Record<number, number>>({});
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [historyQuery, setHistoryQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [pasteMessage, setPasteMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const rateLimiterRef = useRef(createRateLimiter(SEARCH_RATE_LIMIT, SEARCH_RATE_WINDOW_MS));
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const filteredItems = useMemo(
    () => filterMediaItems(mediaItems, mediaFilter),
    [mediaItems, mediaFilter]
  );
  const mediaGroups = useMemo(() => groupMediaItems(filteredItems), [filteredItems]);
  const filters = useMemo(() => availableMediaFilters(mediaItems), [mediaItems]);
  const visibleHistory = useMemo(
    () => filterHistoryEntries(history, historyQuery),
    [history, historyQuery]
  );

  const applyUrl = (inputUrl: string) => {
    setUrl(inputUrl);
    setError(null);
    setMediaItems([]);
    setSelectedByGroup({});
    setMediaFilter('all');
    setShareMessage(null);

    if (inputUrl.trim()) {
      setLinkInfo(detectPlatform(inputUrl));
    } else {
      setLinkInfo(null);
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const fromQuery = readUrlQueryParam(window.location.search);
    if (fromQuery) {
      setUrl(fromQuery);
      setLinkInfo(detectPlatform(fromQuery));
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isCancelHotkey(event) && abortRef.current) {
        abortRef.current.abort();
        setIsDownloading(false);
        setError('Recherche annulée');
      }
      if (isSearchHotkey(event)) {
        event.preventDefault();
        const search = document.querySelector<HTMLButtonElement>('[data-search-media]');
        search?.click();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyUrl(e.target.value);
  };

  const handleDownload = async () => {
    const info = detectPlatform(url);
    setLinkInfo(info);

    if (!info.isValid || !url.trim()) {
      setError(info.error || 'Veuillez entrer un lien valide');
      return;
    }

    const limit = rateLimiterRef.current();
    if (!limit.allowed) {
      const seconds = Math.ceil(limit.retryAfterMs / 1000);
      setError(`Trop de recherches. Réessayez dans ${seconds}s.`);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsDownloading(true);
    setError(null);
    setMediaItems([]);
    setSelectedByGroup({});
    setMediaFilter('all');

    try {
      const result = await downloadMedia(info.canonicalUrl ?? url, info.platform, controller.signal);

      if (controller.signal.aborted) {
        setError('Recherche annulée');
        return;
      }

      if (result.success && result.mediaItems && result.mediaItems.length > 0) {
        setMediaItems(result.mediaItems);
        const defaults: Record<number, number> = {};
        groupMediaItems(result.mediaItems).forEach((_group, gi) => {
          defaults[gi] = 0;
        });
        setSelectedByGroup(defaults);
        setHistory(addHistoryEntry(info.canonicalUrl ?? url, info.platform, result.mediaItems.length));
      } else {
        if (info.platform === 'instagram') {
          setError(
            result.error ||
              'Impossible de télécharger le média Instagram. ' +
                'Vérifiez que :\n' +
                '• Le compte est public\n' +
                '• Le lien est correct\n' +
                '• Le post n\'est pas supprimé'
          );
        } else {
          setError(
            result.error ||
              'Aucun média trouvé. Le contenu est peut-être privé ou le lien est invalide.'
          );
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      if (info.platform === 'instagram') {
        setError(
          `Erreur Instagram: ${errorMessage}. Essayez avec un autre lien ou vérifiez que le compte est public.`
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsDownloading(false);
    setError('Recherche annulée');
  };

  const handleDownloadSelected = async (groupIndex: number) => {
    const group = mediaGroups[groupIndex];
    if (!group) return;
    const selectedOffset = selectedByGroup[groupIndex] ?? 0;
    const entry = group.items[selectedOffset] || group.items[0];
    if (!entry) return;

    setDownloadingUrl(entry.item.url);
    try {
      const sizePart =
        entry.item.quality ||
        (entry.item.width && entry.item.height
          ? `${entry.item.width}x${entry.item.height}`
          : 'media');
      const platform: Platform = linkInfo?.platform ?? 'unknown';
      const filename = sanitizeFilename(`${platform}-${sizePart}-${Date.now()}`);
      await triggerDownload(entry.item.url, filename, entry.item.type);
    } catch (err) {
      setError(
        `Erreur lors du téléchargement: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
      );
    } finally {
      setDownloadingUrl(null);
    }
  };

  const handleDownloadAll = async () => {
    for (let index = 0; index < mediaGroups.length; index += 1) {
      await handleDownloadSelected(index);
    }
  };

  const handleCopyMediaUrl = async (mediaUrl: string) => {
    const ok = await writeClipboardText(mediaUrl);
    setCopyMessage(ok ? 'Lien média copié' : 'Impossible de copier le lien');
    window.setTimeout(() => setCopyMessage(null), 2500);
  };

  const handlePaste = async () => {
    const text = await readClipboardText();
    if (!text) {
      setPasteMessage('Presse-papiers vide ou inaccessible');
      window.setTimeout(() => setPasteMessage(null), 2500);
      return;
    }
    const extracted = extractInputUrl(text);
    if (!extracted) {
      applyUrl(text);
      setPasteMessage('Aucun lien supporté dans le presse-papiers');
      window.setTimeout(() => setPasteMessage(null), 2500);
      return;
    }
    applyUrl(extracted);
    setPasteMessage('Lien collé');
    window.setTimeout(() => setPasteMessage(null), 2000);
  };

  const handleShare = async () => {
    const share = buildShareUrl(window.location.href, url);
    if (!share) return;
    const ok = await writeClipboardText(share);
    setShareMessage(ok ? 'Lien de partage copié' : share);
    window.setTimeout(() => setShareMessage(null), 2500);
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setHistory(importHistoryJson(text));
  };

  const handleExport = () => {
    const blob = new Blob([exportHistoryJson(history)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'twit-history.json';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(href), 100);
  };

  const handleExportCsv = () => {
    const blob = new Blob([exportHistoryCsv(history)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'twit-history.csv';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(href), 100);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const dropped = extractDroppedUrl(event.dataTransfer);
    if (!dropped) {
      setPasteMessage('Déposez un lien Instagram, Twitter/X, TikTok, Snapchat, Threads, Bluesky ou Reddit');
      window.setTimeout(() => setPasteMessage(null), 2500);
      return;
    }
    applyUrl(dropped);
    setPasteMessage('Lien déposé');
    window.setTimeout(() => setPasteMessage(null), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setTheme((current) => toggleTheme(current))}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600"
            aria-label={theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
          >
            {theme === 'dark' ? '☀️ Clair' : '🌙 Sombre'}
          </button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Téléchargeur de Médias
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            Téléchargez des vidéos, images et GIFs publics depuis Instagram, Twitter/X, Snapchat, TikTok, Threads, Bluesky ou Reddit. Ctrl/⌘+Entrée pour rechercher, Échap pour annuler.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleDownload();
          }}
        >
          <div
            className={`relative rounded-xl ${
              isDragOver ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800' : ''
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              type="text"
              value={url}
              onChange={handleUrlChange}
              aria-label="Lien du média"
              placeholder="Collez ou déposez un lien… instagram.com/p/… x.com/…/status/… reddit.com/r/…/comments/…"
              className="w-full px-4 py-4 pr-40 rounded-xl border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 focus:outline-none transition-colors bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 text-sm sm:text-base"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {url && (
                <button
                  type="button"
                  onClick={() => applyUrl('')}
                  className="px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  aria-label="Effacer le lien"
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => void handlePaste()}
                className="px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Coller
              </button>
              {linkInfo && <span className="text-xl">{getPlatformIcon(linkInfo.platform)}</span>}
            </div>
          </div>

          {pasteMessage && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">{pasteMessage}</p>
          )}

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="submit"
              data-search-media
              disabled={!linkInfo?.isValid || isDownloading}
              className="sm:col-span-2 py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg disabled:shadow-none"
            >
              {isDownloading ? 'Recherche en cours...' : 'Rechercher le média'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={!isDownloading}
              className="py-4 px-4 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold disabled:opacity-40"
            >
              Annuler
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!linkInfo?.isValid}
            className="w-full py-3 px-4 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-200 font-semibold disabled:opacity-40"
          >
            Partager
          </button>
          {shareMessage && (
            <p className="text-center text-sm text-blue-600 dark:text-blue-300">{shareMessage}</p>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-red-600 dark:text-red-400 text-sm sm:text-base text-center whitespace-pre-line">
                {error}
              </p>
            </div>
          )}
        </form>

          {mediaGroups.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Médias trouvés — choisissez la taille
                </h3>
                <button
                  type="button"
                  onClick={() => void handleDownloadAll()}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold"
                >
                  Tout télécharger
                </button>
              </div>

              {filters.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setMediaFilter(filter);
                        setSelectedByGroup({});
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                        mediaFilter === filter
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {filter === 'all' ? 'Tous' : getMediaTypeName(filter)}
                    </button>
                  ))}
                </div>
              )}

              {copyMessage && (
                <p className="text-sm text-center text-green-600 dark:text-green-400">{copyMessage}</p>
              )}

              <div className="grid grid-cols-1 gap-4">
                {mediaGroups.map((group, groupIndex) => {
                  const selectedOffset = selectedByGroup[groupIndex] ?? 0;
                  const selected = group.items[selectedOffset]?.item;
                  const isBusy = Boolean(selected && downloadingUrl === selected.url);
                  const hasMultipleSizes = group.items.length > 1;

                  return (
                    <div
                      key={`${group.type}-${groupIndex}`}
                      className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-4 border border-gray-200 dark:border-gray-700"
                    >
                      <div className="relative aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden">
                        {group.thumbnail ? (
                          <img
                            src={group.thumbnail}
                            alt={`Aperçu ${groupIndex + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-4xl">{getMediaTypeIcon(group.type)}</span>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-semibold">
                          {getMediaTypeIcon(group.type)} {getMediaTypeName(group.type)}
                        </div>
                      </div>

                      {hasMultipleSizes ? (
                        <fieldset className="space-y-2">
                          <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Taille / qualité
                          </legend>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {group.items.map(({ item }, offset) => {
                              const active = selectedOffset === offset;
                              return (
                                <label
                                  key={item.url}
                                  className={`cursor-pointer rounded-lg border-2 px-3 py-3 text-center transition-all ${
                                    active
                                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200'
                                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    className="sr-only"
                                    name={`size-group-${groupIndex}`}
                                    checked={active}
                                    onChange={() =>
                                      setSelectedByGroup((prev) => ({
                                        ...prev,
                                        [groupIndex]: offset,
                                      }))
                                    }
                                  />
                                  <div className="font-bold text-sm sm:text-base">
                                    {item.quality || sizeOptionLabel(item)}
                                  </div>
                                  {(item.width || item.height) && (
                                    <div className="text-xs opacity-80 mt-0.5">
                                      {item.width}×{item.height}
                                      {item.quality && Math.max(item.width || 0, item.height || 0) >= 720
                                        ? ' · HD'
                                        : ''}
                                    </div>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ) : (
                        selected && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                            Qualité : {sizeOptionLabel(selected)}
                          </p>
                        )
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDownloadSelected(groupIndex)}
                          disabled={isBusy || !selected}
                          className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {isBusy ? 'Téléchargement...' : (
                            <>
                              <span>⬇️</span>
                              Télécharger
                              {selected?.quality ? ` ${selected.quality}` : ''}
                              {selected?.width && selected?.height
                                ? ` (${selected.width}×${selected.height})`
                                : ''}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => selected && void handleCopyMediaUrl(selected.url)}
                          disabled={!selected}
                          className="w-full py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm disabled:opacity-50"
                        >
                          Copier le lien
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Historique local</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700"
              >
                Exporter JSON
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700"
              >
                Exporter CSV
              </button>
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700"
              >
                Importer
              </button>
              <button
                type="button"
                onClick={() => setHistory(clearHistory())}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200"
              >
                Tout supprimer
              </button>
            </div>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              void handleImportFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <input
            type="search"
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Filtrer l’historique"
            aria-label="Filtrer l’historique"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm"
          />
          {visibleHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucun lien enregistré.</p>
          ) : (
            <ul className="space-y-2">
              {visibleHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2"
                >
                  <button
                    type="button"
                    className="text-left text-sm text-blue-700 dark:text-blue-300 truncate"
                    onClick={() => applyUrl(entry.url)}
                  >
                    {getPlatformIcon(entry.platform)} {entry.url}
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${entry.url}`}
                    onClick={() => setHistory(removeHistoryEntry(entry.id))}
                    className="text-xs text-red-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">📷</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Instagram</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Vidéos, Images, Reels</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🐦</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Twitter/X</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Choix de taille HD / SD</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">👻</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Snapchat</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Stories publiques</div>
          </div>
          <div className="bg-gradient-to-br from-gray-50 to-rose-50 dark:from-gray-900/40 dark:to-rose-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🎵</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">TikTok</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Vidéos et liens courts</div>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900/40 dark:to-indigo-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🧵</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Threads</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Posts publics</div>
          </div>
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🦋</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Bluesky</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Posts publics AT Protocol</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🟠</div>
            <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">Reddit</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Posts et galeries publics</div>
          </div>
        </div>
      </div>
    </div>
  );
};
