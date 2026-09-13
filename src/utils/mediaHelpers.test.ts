import { describe, expect, it } from 'vitest';
import { extensionForMediaType, getMediaTypeIcon, getMediaTypeName } from './mediaHelpers';

describe('mediaHelpers', () => {
  it('mappe les types vers libellés, icônes et extensions', () => {
    expect(getMediaTypeName('video')).toBe('Vidéo');
    expect(getMediaTypeName('image')).toBe('Image');
    expect(getMediaTypeIcon('gif')).toBe('🎬');
    expect(extensionForMediaType('video')).toBe('mp4');
    expect(extensionForMediaType('unknown')).toBe('bin');
  });
});
