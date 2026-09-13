import type { MediaType, Platform } from '../utils/linkDetector';

export interface MediaItem {
  url: string;
  type: MediaType;
  thumbnail?: string;
}

export interface DownloadResponse {
  success: boolean;
  mediaItems?: MediaItem[];
  error?: string;
  platform?: Platform;
  mediaType?: MediaType;
}
