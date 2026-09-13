import type { MediaItem } from '../types/media';
import { validatePublicHttpUrl } from '../utils/security';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function toSafeMediaUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const validation = validatePublicHttpUrl(raw, { httpsOnly: true });
  return validation.ok ? validation.url.href : null;
}

function bestMp4Variant(variants: unknown): string | null {
  const mp4s = asArray(variants)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .filter((item) => item.content_type === 'video/mp4' && typeof item.url === 'string')
    .sort((a, b) => Number(b.bitrate ?? 0) - Number(a.bitrate ?? 0));

  return mp4s[0] ? toSafeMediaUrl(mp4s[0].url) : null;
}

export function parseFxTwitterResponse(data: unknown): MediaItem[] {
  const tweet = asRecord(asRecord(data)?.tweet);
  const media = asRecord(tweet?.media);
  if (!media) return [];

  const items: MediaItem[] = [];

  for (const video of asArray(media.videos)) {
    const record = asRecord(video);
    if (!record) continue;
    const source = asRecord(record.source);
    const url = toSafeMediaUrl(pickString(record.url, record.video_url, source?.url));
    if (!url) continue;
    items.push({
      url,
      type: 'video',
      thumbnail: toSafeMediaUrl(pickString(record.thumbnail_url, record.preview_image_url)) ?? undefined,
    });
  }

  for (const photo of asArray(media.photos)) {
    const record = asRecord(photo);
    if (!record) continue;
    const url = toSafeMediaUrl(pickString(record.url, record.media_url_https));
    if (!url) continue;
    items.push({ url, type: 'image' });
  }

  for (const gif of asArray(media.animated_gif)) {
    const record = asRecord(gif);
    if (!record) continue;
    const info = asRecord(record.video_info);
    const url = bestMp4Variant(info?.variants);
    if (!url) continue;
    items.push({
      url,
      type: 'gif',
      thumbnail: toSafeMediaUrl(pickString(record.media_url_https, record.preview_image_url)) ?? undefined,
    });
  }

  return items;
}

export function parseVxTwitterResponse(data: unknown): MediaItem[] {
  const media = asArray(asRecord(data)?.media);
  const items: MediaItem[] = [];

  for (const entry of media) {
    const record = asRecord(entry);
    if (!record) continue;
    const type = typeof record.type === 'string' ? record.type : '';
    const info = asRecord(record.video_info);

    if (type === 'video') {
      const url = bestMp4Variant(info?.variants) ?? toSafeMediaUrl(record.url);
      if (!url) continue;
      items.push({
        url,
        type: 'video',
        thumbnail: toSafeMediaUrl(record.media_url_https) ?? undefined,
      });
    } else if (type === 'photo') {
      const url = toSafeMediaUrl(pickString(record.media_url_https, record.url));
      if (!url) continue;
      items.push({ url, type: 'image' });
    } else if (type === 'animated_gif') {
      const url = bestMp4Variant(info?.variants);
      if (!url) continue;
      items.push({
        url,
        type: 'gif',
        thumbnail: toSafeMediaUrl(record.media_url_https) ?? undefined,
      });
    }
  }

  return items;
}

export function parseGenericDownloaderItems(data: unknown): MediaItem[] {
  const root = asRecord(data);
  if (!root) return [];
  const status = root.status;
  if (status !== 'ok' && status !== 'success') return [];

  const items: MediaItem[] = [];
  for (const entry of asArray(root.items)) {
    const record = asRecord(entry);
    if (!record) continue;
    const url = toSafeMediaUrl(
      pickString(record.url, record.downloadUrl, record.video, record.image, record.media)
    );
    if (!url) continue;

    const looksVideo =
      record.type === 'video' ||
      record.media_type === 'video' ||
      record.mediaType === 'video' ||
      Boolean(record.video) ||
      url.includes('.mp4');

    items.push({
      url,
      type: looksVideo ? 'video' : 'image',
      thumbnail: toSafeMediaUrl(pickString(record.thumbnail, record.image)) ?? undefined,
    });
  }
  return items;
}

export function parseTikTokApiResponse(data: unknown): MediaItem[] {
  const root = asRecord(data);
  if (!root || Number(root.code) !== 0) return [];
  const payload = asRecord(root.data);
  if (!payload) return [];

  const items: MediaItem[] = [];
  const videoUrl = toSafeMediaUrl(pickString(payload.hdplay, payload.play, payload.wmplay));
  const cover = toSafeMediaUrl(pickString(payload.origin_cover, payload.cover));

  if (videoUrl) {
    items.push({
      url: videoUrl,
      type: 'video',
      thumbnail: cover ?? undefined,
    });
  }

  for (const image of asArray(payload.images)) {
    const url = toSafeMediaUrl(image);
    if (!url) continue;
    items.push({ url, type: 'image', thumbnail: url });
  }

  return items;
}
