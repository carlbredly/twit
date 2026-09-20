import { useMemo, useState } from 'react';
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

type MediaGroup = {
  thumbnail?: string;
  type: MediaType;
  items: { item: MediaItem; index: number }[];
};

const groupMediaItems = (items: MediaItem[]): MediaGroup[] => {
  const groups: MediaGroup[] = [];
  const byKey = new Map<string, number>();

  items.forEach((item, index) => {
    const groupKey =
      item.type === 'image'
        ? `image:${item.url}`
        : `av:${item.thumbnail || item.url.replace(/\/vid\/\d+x\d+\/[^/]+$/, '')}`;

    const existing = byKey.get(groupKey);
    if (existing !== undefined) {
      groups[existing].items.push({ item, index });
      return;
    }
    byKey.set(groupKey, groups.length);
    groups.push({
      thumbnail: item.thumbnail || (item.type === 'image' ? item.url : undefined),
      type: item.type,
      items: [{ item, index }],
    });
  });

  return groups;
};

const sizeOptionLabel = (item: MediaItem): string => {
  if (item.quality && item.width && item.height) {
    return `${item.quality} · ${item.width}×${item.height}`;
  }
  if (item.width && item.height) {
    return `${item.width}×${item.height}`;
  }
  if (item.quality) return item.quality;
  return item.label || 'Qualité standard';
};

export const VideoDownloader = () => {
  const [url, setUrl] = useState('');
  const [linkInfo, setLinkInfo] = useState<{ platform: Platform; isValid: boolean } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  /** Selected size index within each media group */
  const [selectedByGroup, setSelectedByGroup] = useState<Record<number, number>>({});

  const mediaGroups = useMemo(() => groupMediaItems(mediaItems), [mediaItems]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setError(null);
    setMediaItems([]);
    setSelectedByGroup({});

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
    setSelectedByGroup({});

    try {
      const result = await downloadMedia(url, linkInfo.platform);

      if (result.success && result.mediaItems && result.mediaItems.length > 0) {
        setMediaItems(result.mediaItems);
        // Default: best quality (first item in each group — already sorted desc)
        const defaults: Record<number, number> = {};
        groupMediaItems(result.mediaItems).forEach((_group, gi) => {
          defaults[gi] = 0;
        });
        setSelectedByGroup(defaults);
      } else {
        if (linkInfo.platform === 'instagram') {
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
      if (linkInfo.platform === 'instagram') {
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

  const handleDownloadSelected = async (groupIndex: number) => {
    const group = mediaGroups[groupIndex];
    if (!group) return;
    const selectedOffset = selectedByGroup[groupIndex] ?? 0;
    const entry = group.items[selectedOffset] || group.items[0];
    if (!entry) return;

    setDownloadingIndex(entry.index);
    try {
      const sizePart =
        entry.item.quality ||
        (entry.item.width && entry.item.height
          ? `${entry.item.width}x${entry.item.height}`
          : 'media');
      const filename = `twitter-${sizePart}-${Date.now()}`;
      await triggerDownload(entry.item.url, filename, entry.item.type);
    } catch (err) {
      setError(
        `Erreur lors du téléchargement: ${err instanceof Error ? err.message : 'Erreur inconnue'}`
      );
    } finally {
      setDownloadingIndex(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Téléchargeur de Médias
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            Téléchargez des vidéos, images et GIFs depuis Instagram, Twitter/X ou Snapchat
          </p>
        </div>

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
                  : 'Lien non reconnu'}
              </span>
            </div>
          )}

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
              'Rechercher le média'
            )}
          </button>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-red-600 dark:text-red-400 text-sm sm:text-base text-center whitespace-pre-line">
                {error}
              </p>
            </div>
          )}

          {mediaGroups.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Médias trouvés — choisissez la taille
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {mediaGroups.map((group, groupIndex) => {
                  const selectedOffset = selectedByGroup[groupIndex] ?? 0;
                  const selected = group.items[selectedOffset]?.item;
                  const isBusy =
                    downloadingIndex !== null &&
                    group.items.some(({ index }) => index === downloadingIndex);
                  const hasMultipleSizes = group.items.length > 1;

                  return (
                    <div
                      key={groupIndex}
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
                                  key={offset}
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

                      <button
                        onClick={() => handleDownloadSelected(groupIndex)}
                        disabled={isBusy || !selected}
                        className="w-full py-3 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        {isBusy ? (
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
                            Télécharger
                            {selected?.quality ? ` ${selected.quality}` : ''}
                            {selected?.width && selected?.height
                              ? ` (${selected.width}×${selected.height})`
                              : ''}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
        </div>
      </div>
    </div>
  );
};
