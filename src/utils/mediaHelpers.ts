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

export const extensionForMediaType = (type: MediaType): string => {
  switch (type) {
    case 'video':
      return 'mp4';
    case 'gif':
      return 'gif';
    case 'image':
      return 'jpg';
    default:
      return 'bin';
  }
};
