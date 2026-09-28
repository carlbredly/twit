import type { MediaType, Platform } from '../utils/linkDetector';

export interface MediaItem {
  url: string;
  type: MediaType;
  thumbnail?: string;
  /** Human label, e.g. "1280×720 (HD)" */
  label?: string;
  /** Short quality tag, e.g. "720p" */
  quality?: string;
  width?: number;
  height?: number;
  bitrate?: number;
}

export interface DownloadResponse {
  success: boolean;
  mediaItems?: MediaItem[];
  error?: string;
  platform?: Platform;
  mediaType?: MediaType;
}

export type MediaFilter = 'all' | MediaType;
