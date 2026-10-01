import type { MediaItem } from '../types/media';
import type { MediaType } from '../utils/linkDetector';
import { dedupeMediaItems } from '../utils/mediaHelpers';
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

interface VideoVariant {
  url?: string;
  bitrate?: number;
  content_type?: string;
  width?: number;
  height?: number;
  container?: string;
}

const parseResolutionFromUrl = (url: string): { width?: number; height?: number } => {
  const match = url.match(/\/(\d{2,4})x(\d{2,4})\//);
  if (!match) return {};
  return { width: Number(match[1]), height: Number(match[2]) };
};

const qualityTag = (width?: number, height?: number, bitrate?: number): string | undefined => {
  if (width && height) {
    const shortEdge = Math.min(width, height);
    if (shortEdge >= 1080) return '1080p';
    if (shortEdge >= 720) return '720p';
    if (shortEdge >= 480) return '480p';
    if (shortEdge >= 360) return '360p';
    if (shortEdge >= 240) return '240p';
    return `${shortEdge}p`;
  }
  if (bitrate && bitrate >= 2_000_000) return '720p';
  if (bitrate && bitrate >= 800_000) return '360p';
  if (bitrate) return '240p';
  return undefined;
};

const qualityLabel = (
  type: MediaType,
  width?: number,
  height?: number,
  bitrate?: number
): string => {
  if (type === 'image') return 'Image originale';
  if (type === 'gif') {
    if (width && height) return `GIF ${width}×${height}`;
    return 'GIF';
  }
  const tag = qualityTag(width, height, bitrate);
  if (width && height) {
    const isHd = Math.max(width, height) >= 720;
    return isHd ? `${width}×${height} (HD)` : `${width}×${height}`;
  }
  if (tag) return tag;
  return 'Vidéo';
};

const toVariant = (item: Record<string, unknown>): VideoVariant => ({
  url: typeof item.url === 'string' ? item.url : undefined,
  bitrate: typeof item.bitrate === 'number' ? item.bitrate : undefined,
  content_type: typeof item.content_type === 'string' ? item.content_type : undefined,
  width: typeof item.width === 'number' ? item.width : undefined,
  height: typeof item.height === 'number' ? item.height : undefined,
  container: typeof item.container === 'string' ? item.container : undefined,
});

const mp4VariantsFromList = (variants: unknown): VideoVariant[] => {
  return asArray(variants)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(toVariant)
    .filter((v) => v.url && (v.content_type === 'video/mp4' || v.url.includes('.mp4')))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
};

function pushVideoLike(
  items: MediaItem[],
  record: Record<string, unknown>,
  type: MediaType
): void {
  const variants = mp4VariantsFromList(record.variants);
  const thumbnail =
    toSafeMediaUrl(pickString(record.thumbnail_url, record.preview_image_url, record.media_url_https)) ??
    undefined;

  if (variants.length > 0) {
    for (const variant of variants) {
      if (!variant.url) continue;
      const url = toSafeMediaUrl(variant.url);
      if (!url) continue;
      const fromUrl = parseResolutionFromUrl(url);
      const width = variant.width || fromUrl.width || (typeof record.width === 'number' ? record.width : undefined);
      const height =
        variant.height || fromUrl.height || (typeof record.height === 'number' ? record.height : undefined);
      items.push({
        url,
        type,
        thumbnail,
        width,
        height,
        bitrate: variant.bitrate,
        quality: qualityTag(width, height, variant.bitrate),
        label: qualityLabel(type, width, height, variant.bitrate),
      });
    }
    return;
  }

  const formats = asArray(record.formats)
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => item !== null)
    .map(toVariant)
    .filter((f) => f.url && (f.container === 'mp4' || f.url.includes('.mp4')))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

  if (formats.length > 0) {
    for (const format of formats) {
      if (!format.url) continue;
      const url = toSafeMediaUrl(format.url);
      if (!url) continue;
      const fromUrl = parseResolutionFromUrl(url);
      const width = fromUrl.width || (typeof record.width === 'number' ? record.width : undefined);
      const height = fromUrl.height || (typeof record.height === 'number' ? record.height : undefined);
      items.push({
        url,
        type,
        thumbnail,
        width,
        height,
        bitrate: format.bitrate,
        quality: qualityTag(width, height, format.bitrate),
        label: qualityLabel(type, width, height, format.bitrate),
      });
    }
    return;
  }

  const source = asRecord(record.source);
  const videoUrl = toSafeMediaUrl(pickString(record.url, record.video_url, source?.url));
  if (!videoUrl) return;
  const fromUrl = parseResolutionFromUrl(videoUrl);
  const width = (typeof record.width === 'number' ? record.width : undefined) || fromUrl.width;
  const height = (typeof record.height === 'number' ? record.height : undefined) || fromUrl.height;
  items.push({
    url: videoUrl,
    type,
    thumbnail,
    width,
    height,
    quality: qualityTag(width, height),
    label: qualityLabel(type, width, height),
  });
}

export function parseFxTwitterResponse(data: unknown): MediaItem[] {
  const tweet = asRecord(asRecord(data)?.tweet);
  const media = asRecord(tweet?.media);
  if (!media) return [];

  const items: MediaItem[] = [];

  for (const video of asArray(media.videos)) {
    const record = asRecord(video);
    if (!record) continue;
    const type: MediaType =
      record.type === 'gif' || record.type === 'animated_gif' ? 'gif' : 'video';
    pushVideoLike(items, record, type);
  }

  for (const photo of asArray(media.photos)) {
    const record = asRecord(photo);
    if (!record) continue;
    const url = toSafeMediaUrl(pickString(record.url, record.media_url_https));
    if (!url) continue;
    items.push({
      url,
      type: 'image',
      quality: 'orig',
      label: qualityLabel('image'),
    });
  }

  for (const gif of asArray(media.animated_gif)) {
    const record = asRecord(gif);
    if (!record) continue;
    const info = asRecord(record.video_info);
    const variants = mp4VariantsFromList(info?.variants);
    const gifUrl = toSafeMediaUrl(pickString(record.url, variants[0]?.url, record.video_url));
    if (!gifUrl) continue;
    const fromUrl = parseResolutionFromUrl(gifUrl);
    items.push({
      url: gifUrl,
      type: 'gif',
      thumbnail:
        toSafeMediaUrl(pickString(record.thumbnail_url, record.media_url_https, record.preview_image_url)) ??
        undefined,
      width: fromUrl.width,
      height: fromUrl.height,
      quality: qualityTag(fromUrl.width, fromUrl.height),
      label: qualityLabel('gif', fromUrl.width, fromUrl.height),
    });
  }

  return dedupeMediaItems(items);
}

export function parseVxTwitterResponse(data: unknown): MediaItem[] {
  const root = asRecord(data);
  const items: MediaItem[] = [];
  const extended = asArray(root?.media_extended);

  if (extended.length > 0) {
    for (const entry of extended) {
      const record = asRecord(entry);
      if (!record) continue;
      const url = toSafeMediaUrl(record.url);
      if (!url) continue;
      const typeRaw = typeof record.type === 'string' ? record.type : '';
      const fromUrl = parseResolutionFromUrl(url);
      if (typeRaw === 'video') {
        items.push({
          url,
          type: 'video',
          thumbnail: toSafeMediaUrl(record.thumbnail_url) ?? undefined,
          width: fromUrl.width,
          height: fromUrl.height,
          quality: qualityTag(fromUrl.width, fromUrl.height),
          label: qualityLabel('video', fromUrl.width, fromUrl.height),
        });
      } else if (typeRaw === 'gif' || typeRaw === 'animated_gif') {
        items.push({
          url,
          type: 'gif',
          thumbnail: toSafeMediaUrl(record.thumbnail_url) ?? undefined,
          label: qualityLabel('gif'),
        });
      } else if (typeRaw === 'image' || typeRaw === 'photo') {
        items.push({
          url,
          type: 'image',
          quality: 'orig',
          label: qualityLabel('image'),
        });
      }
    }
  }

  if (items.length === 0) {
    const media = asArray(root?.media);
    for (const entry of media) {
      const record = asRecord(entry);
      if (!record) continue;
      const type = typeof record.type === 'string' ? record.type : '';
      const info = asRecord(record.video_info);

      if (type === 'video') {
        const variants = mp4VariantsFromList(info?.variants);
        const url = toSafeMediaUrl(variants[0]?.url) ?? toSafeMediaUrl(record.url);
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
        const variants = mp4VariantsFromList(info?.variants);
        const url = toSafeMediaUrl(variants[0]?.url);
        if (!url) continue;
        items.push({
          url,
          type: 'gif',
          thumbnail: toSafeMediaUrl(record.media_url_https) ?? undefined,
        });
      }
    }
  }

  if (items.length === 0) {
    for (const mediaUrl of asArray(root?.mediaURLs)) {
      if (typeof mediaUrl !== 'string') continue;
      const url = toSafeMediaUrl(mediaUrl);
      if (!url) continue;
      const lower = url.toLowerCase();
      const type: MediaType =
        lower.includes('.mp4') || lower.includes('video.twimg.com') ? 'video' : 'image';
      const fromUrl = parseResolutionFromUrl(url);
      items.push({
        url,
        type,
        width: fromUrl.width,
        height: fromUrl.height,
        quality: qualityTag(fromUrl.width, fromUrl.height),
        label: qualityLabel(type, fromUrl.width, fromUrl.height),
      });
    }
  }

  return dedupeMediaItems(items);
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
  return dedupeMediaItems(items);
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

  return dedupeMediaItems(items);
}

function unescapeHtmlAttr(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .replace(/&quot;/g, '"');
}

function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
      'i'
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return unescapeHtmlAttr(match[1]);
  }
  return null;
}

/** Extract public HTTPS media from Open Graph / Twitter card tags. */
export function parseOpenGraphMedia(html: string): MediaItem[] {
  if (typeof html !== 'string' || html.length === 0 || html.length > 2_000_000) {
    return [];
  }

  const items: MediaItem[] = [];
  const video =
    metaContent(html, 'og:video') ||
    metaContent(html, 'og:video:url') ||
    metaContent(html, 'og:video:secure_url');
  const videoUrl = toSafeMediaUrl(video);
  const image =
    metaContent(html, 'og:image') ||
    metaContent(html, 'og:image:url') ||
    metaContent(html, 'twitter:image');
  const imageUrl = toSafeMediaUrl(image);

  if (videoUrl) {
    items.push({
      url: videoUrl,
      type: 'video',
      thumbnail: imageUrl ?? undefined,
    });
  } else if (imageUrl) {
    items.push({ url: imageUrl, type: 'image', thumbnail: imageUrl });
  }

  return dedupeMediaItems(items);
}

export function parseOEmbedThumbnail(data: unknown): MediaItem[] {
  const root = asRecord(data);
  if (!root) return [];
  const thumbnail = toSafeMediaUrl(root.thumbnail_url);
  if (!thumbnail) return [];
  return [{ url: thumbnail, type: 'image', thumbnail }];
}

function blobUrl(did: string, cid: string): string | null {
  if (!did || !cid) return null;
  return toSafeMediaUrl(
    `https://public.api.bsky.app/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`
  );
}

function collectBlueskyEmbed(
  items: MediaItem[],
  embed: Record<string, unknown> | null,
  did: string
): void {
  if (!embed) return;
  const type = typeof embed.$type === 'string' ? embed.$type : '';

  if (type.includes('app.bsky.embed.images')) {
    for (const entry of asArray(embed.images)) {
      const image = asRecord(entry);
      if (!image) continue;
      const url = toSafeMediaUrl(pickString(image.fullsize, image.thumb));
      if (!url) continue;
      items.push({
        url,
        type: 'image',
        thumbnail: toSafeMediaUrl(image.thumb) ?? url,
        quality: 'orig',
        label: qualityLabel('image'),
      });
    }
  }

  if (type.includes('app.bsky.embed.video')) {
    const cid = pickString(embed.cid);
    const videoUrl =
      (cid ? blobUrl(did, cid) : null) || toSafeMediaUrl(pickString(embed.playlist));
    if (videoUrl) {
      const aspect = asRecord(embed.aspectRatio);
      const width = typeof aspect?.width === 'number' ? aspect.width : undefined;
      const height = typeof aspect?.height === 'number' ? aspect.height : undefined;
      items.push({
        url: videoUrl,
        type: 'video',
        thumbnail: toSafeMediaUrl(embed.thumbnail) ?? undefined,
        width,
        height,
        quality: qualityTag(width, height),
        label: qualityLabel('video', width, height),
      });
    }
  }

  if (type.includes('app.bsky.embed.external')) {
    const external = asRecord(embed.external) ?? embed;
    const thumb = toSafeMediaUrl(pickString(external.thumb, embed.thumb));
    if (thumb) {
      items.push({ url: thumb, type: 'image', thumbnail: thumb, label: qualityLabel('image') });
    }
  }

  if (type.includes('app.bsky.embed.recordWithMedia')) {
    collectBlueskyEmbed(items, asRecord(embed.media), did);
  }
}

function decodeRedditUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return toSafeMediaUrl(raw.replace(/&amp;/g, '&'));
}

function collectRedditPost(post: Record<string, unknown>, items: MediaItem[]): void {
  const media = asRecord(post.secure_media) ?? asRecord(post.media);
  const redditVideo = asRecord(media?.reddit_video);
  if (redditVideo) {
    const url = decodeRedditUrl(pickString(redditVideo.fallback_url));
    if (url) {
      const width = typeof redditVideo.width === 'number' ? redditVideo.width : undefined;
      const height = typeof redditVideo.height === 'number' ? redditVideo.height : undefined;
      items.push({
        url,
        type: 'video',
        thumbnail: decodeRedditUrl(post.thumbnail) ?? undefined,
        width,
        height,
        quality: qualityTag(width, height),
        label: qualityLabel('video', width, height),
      });
    }
  }

  const metadata = asRecord(post.media_metadata);
  if (metadata) {
    const gallery = asRecord(post.gallery_data);
    const orderedIds = asArray(gallery?.items)
      .map((entry) => {
        const record = asRecord(entry);
        return typeof record?.media_id === 'string' ? record.media_id : null;
      })
      .filter((id): id is string => Boolean(id));
    const ids = orderedIds.length > 0 ? orderedIds : Object.keys(metadata);

    for (const id of ids) {
      const meta = asRecord(metadata[id]);
      if (!meta) continue;
      const source = asRecord(meta.s);
      const mime = typeof meta.m === 'string' ? meta.m : '';
      const url = decodeRedditUrl(pickString(source?.mp4, source?.gif, source?.u));
      if (!url) continue;
      const type: MediaType = mime.includes('mp4') || url.includes('.mp4')
        ? 'video'
        : mime.includes('gif') || url.includes('.gif')
          ? 'gif'
          : 'image';
      items.push({
        url,
        type,
        thumbnail: decodeRedditUrl(source?.u) ?? url,
        width: typeof source?.x === 'number' ? source.x : undefined,
        height: typeof source?.y === 'number' ? source.y : undefined,
        label: qualityLabel(type),
      });
    }
  }

  const preview = asRecord(post.preview);
  for (const image of asArray(preview?.images)) {
    const record = asRecord(image);
    const source = asRecord(record?.source);
    const url = decodeRedditUrl(source?.url);
    if (!url) continue;
    items.push({
      url,
      type: 'image',
      thumbnail: url,
      width: typeof source?.width === 'number' ? source.width : undefined,
      height: typeof source?.height === 'number' ? source.height : undefined,
      quality: 'orig',
      label: qualityLabel('image'),
    });
  }

  const dest = decodeRedditUrl(pickString(post.url_overridden_by_dest, post.url));
  if (dest && /\.(?:jpe?g|png|webp|gif|mp4)(?:$|\?)/i.test(dest)) {
    const isVideo = dest.includes('.mp4');
    const isGif = dest.includes('.gif');
    items.push({
      url: dest,
      type: isVideo ? 'video' : isGif ? 'gif' : 'image',
      thumbnail: dest,
      label: qualityLabel(isVideo ? 'video' : isGif ? 'gif' : 'image'),
    });
  }
}

/** Parse Reddit listing JSON (`/comments/{id}.json`) into public HTTPS media. */
export function parseRedditListing(data: unknown): MediaItem[] {
  const listing = Array.isArray(data) ? asRecord(data[0]) : asRecord(data);
  const children = asArray(asRecord(listing?.data)?.children);
  const post = asRecord(asRecord(children[0])?.data);
  if (!post) return [];

  const items: MediaItem[] = [];
  collectRedditPost(post, items);

  if (items.length === 0) {
    for (const parent of asArray(post.crosspost_parent_list)) {
      const record = asRecord(parent);
      if (record) collectRedditPost(record, items);
      if (items.length > 0) break;
    }
  }

  return dedupeMediaItems(items);
}

/** Parse app.bsky.feed.getPostThread JSON into public HTTPS media items. */
export function parseBlueskyThread(data: unknown): MediaItem[] {
  const thread = asRecord(asRecord(data)?.thread);
  const post = asRecord(thread?.post);
  if (!post) return [];

  const author = asRecord(post.author);
  const did = typeof author?.did === 'string' ? author.did : '';
  const items: MediaItem[] = [];

  collectBlueskyEmbed(items, asRecord(post.embed), did);

  if (items.length === 0) {
    const record = asRecord(post.record);
    collectBlueskyEmbed(items, asRecord(record?.embed), did);
  }

  return dedupeMediaItems(items);
}
