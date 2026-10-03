import type { MediaFilter, MediaItem } from '../types/media';
import type { MediaType } from './linkDetector';

export const getMediaTypeIcon = (type: MediaType): string => {
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

export const getMediaTypeName = (type: MediaType): string => {
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

export function filterMediaItems(items: MediaItem[], type: MediaFilter): MediaItem[] {
  if (type === 'all') return items;
  return items.filter((item) => item.type === type);
}

export function dedupeMediaItems(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export function availableMediaFilters(items: MediaItem[]): MediaFilter[] {
  const types = new Set(items.map((item) => item.type));
  const filters: MediaFilter[] = ['all'];
  if (types.has('video')) filters.push('video');
  if (types.has('image')) filters.push('image');
  if (types.has('gif')) filters.push('gif');
  return filters;
}

export type MediaGroup = {
  thumbnail?: string;
  type: MediaType;
  items: { item: MediaItem; index: number }[];
};

export const groupMediaItems = (items: MediaItem[]): MediaGroup[] => {
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

export const sizeOptionLabel = (item: MediaItem): string => {
  if (item.quality && item.width && item.height) {
    return `${item.quality} · ${item.width}×${item.height}`;
  }
  if (item.width && item.height) {
    return `${item.width}×${item.height}`;
  }
  if (item.quality) return item.quality;
  return item.label || 'Qualité standard';
};
