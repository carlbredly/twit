import { describe, expect, it } from 'vitest';
import {
  availableMediaFilters,
  dedupeMediaItems,
  filterMediaItems,
  getMediaTypeName,
  groupMediaItems,
} from './mediaHelpers';
import type { MediaItem } from '../types/media';

const items: MediaItem[] = [
  { url: 'https://cdn.example.com/a.mp4', type: 'video' },
  { url: 'https://cdn.example.com/b.jpg', type: 'image' },
  { url: 'https://cdn.example.com/a.mp4', type: 'video' },
  { url: 'https://cdn.example.com/c.gif', type: 'gif' },
];

describe('mediaHelpers', () => {
  it('déduplique par URL', () => {
    expect(dedupeMediaItems(items)).toHaveLength(3);
  });

  it('filtre par type', () => {
    expect(filterMediaItems(items, 'image')).toHaveLength(1);
    expect(filterMediaItems(items, 'all')).toHaveLength(4);
  });

  it('liste les filtres disponibles', () => {
    expect(availableMediaFilters(items)).toEqual(['all', 'video', 'image', 'gif']);
  });

  it('nomme les types', () => {
    expect(getMediaTypeName('gif')).toBe('GIF');
  });

  it('groupe les variantes vidéo', () => {
    const grouped = groupMediaItems([
      {
        url: 'https://video.twimg.com/amplify_video/1/vid/1280x720/x.mp4',
        type: 'video',
        thumbnail: 'https://pbs.twimg.com/thumb.jpg',
        quality: '720p',
      },
      {
        url: 'https://video.twimg.com/amplify_video/1/vid/640x360/x.mp4',
        type: 'video',
        thumbnail: 'https://pbs.twimg.com/thumb.jpg',
        quality: '360p',
      },
    ]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].items).toHaveLength(2);
  });
});
