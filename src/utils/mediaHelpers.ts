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
