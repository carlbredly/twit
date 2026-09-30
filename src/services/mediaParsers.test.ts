import { describe, expect, it } from 'vitest';
import {
  parseFxTwitterResponse,
  parseGenericDownloaderItems,
  parseOEmbedThumbnail,
  parseOpenGraphMedia,
  parseTikTokApiResponse,
  parseVxTwitterResponse,
  parseBlueskyThread,
  toSafeMediaUrl,
} from './mediaParsers';

describe('toSafeMediaUrl', () => {
  it('accepte une URL HTTPS publique', () => {
    expect(toSafeMediaUrl('https://pbs.twimg.com/media/abc.jpg')).toBe(
      'https://pbs.twimg.com/media/abc.jpg'
    );
  });

  it('rejette une URL interne', () => {
    expect(toSafeMediaUrl('http://127.0.0.1/secret.mp4')).toBeNull();
  });

  it('rejette javascript:', () => {
    expect(toSafeMediaUrl('javascript:alert(1)')).toBeNull();
  });

  it('rejette un helper SSRF nip.io', () => {
    expect(toSafeMediaUrl('https://127.0.0.1.nip.io/x.mp4')).toBeNull();
  });
});

describe('parseFxTwitterResponse', () => {
  it('extrait vidéos et photos sûres', () => {
    const items = parseFxTwitterResponse({
      tweet: {
        media: {
          videos: [
            {
              url: 'https://video.twimg.com/a.mp4',
              thumbnail_url: 'https://pbs.twimg.com/thumb.jpg',
            },
            { url: 'http://127.0.0.1/evil.mp4' },
          ],
          photos: [{ url: 'https://pbs.twimg.com/photo.jpg' }],
        },
      },
    });
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('video');
    expect(items[1].type).toBe('image');
  });
});

describe('parseVxTwitterResponse', () => {
  it('prend la meilleure variante mp4', () => {
    const items = parseVxTwitterResponse({
      media: [
        {
          type: 'video',
          media_url_https: 'https://pbs.twimg.com/thumb.jpg',
          video_info: {
            variants: [
              { content_type: 'video/mp4', bitrate: 100, url: 'https://video.twimg.com/low.mp4' },
              { content_type: 'video/mp4', bitrate: 800, url: 'https://video.twimg.com/high.mp4' },
              { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/a.m3u8' },
            ],
          },
        },
      ],
    });
    expect(items[0].url).toBe('https://video.twimg.com/high.mp4');
  });
});

describe('parseGenericDownloaderItems', () => {
  it('ignore les items non HTTPS', () => {
    const items = parseGenericDownloaderItems({
      status: 'ok',
      items: [
        { url: 'https://scontent.cdninstagram.com/v.mp4', type: 'video' },
        { url: 'javascript:alert(1)', type: 'image' },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('video');
  });
});

describe('parseTikTokApiResponse', () => {
  it('extrait hdplay et images', () => {
    const items = parseTikTokApiResponse({
      code: 0,
      data: {
        hdplay: 'https://v16.tiktokcdn.com/video.mp4',
        cover: 'https://p16.tiktokcdn.com/cover.jpg',
        images: ['https://p16.tiktokcdn.com/1.jpg', 'http://169.254.169.254/x.jpg'],
      },
    });
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('video');
    expect(items[1].type).toBe('image');
  });

  it('ignore un code d’erreur', () => {
    expect(parseTikTokApiResponse({ code: 1, data: { play: 'https://v16.tiktokcdn.com/a.mp4' } })).toEqual([]);
  });
});

describe('parseOpenGraphMedia', () => {
  it('extrait og:video HTTPS', () => {
    const items = parseOpenGraphMedia(
      '<meta property="og:video" content="https://cdn.example.com/clip.mp4" /><meta property="og:image" content="https://cdn.example.com/cover.jpg" />'
    );
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('video');
    expect(items[0].url).toBe('https://cdn.example.com/clip.mp4');
  });

  it('extrait og:image si pas de vidéo', () => {
    const items = parseOpenGraphMedia(
      '<meta property="og:image" content="https://cdn.example.com/photo.jpg" />'
    );
    expect(items[0]).toMatchObject({ type: 'image', url: 'https://cdn.example.com/photo.jpg' });
  });

  it('ignore javascript: et hôtes privés', () => {
    expect(
      parseOpenGraphMedia('<meta property="og:image" content="javascript:alert(1)" />')
    ).toEqual([]);
    expect(
      parseOpenGraphMedia('<meta property="og:video" content="http://127.0.0.1/x.mp4" />')
    ).toEqual([]);
  });
});

describe('parseOEmbedThumbnail', () => {
  it('accepte une miniature HTTPS', () => {
    const items = parseOEmbedThumbnail({
      thumbnail_url: 'https://scontent.cdninstagram.com/t.jpg',
    });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('image');
  });

  it('rejette une miniature interne', () => {
    expect(parseOEmbedThumbnail({ thumbnail_url: 'http://169.254.169.254/x.jpg' })).toEqual([]);
  });
});

describe('parseBlueskyThread', () => {
  it('extrait les images publiques et ignore les URL internes', () => {
    const items = parseBlueskyThread({
      thread: {
        post: {
          author: { did: 'did:plc:alice' },
          embed: {
            $type: 'app.bsky.embed.images#view',
            images: [
              { fullsize: 'https://cdn.bsky.app/img/ok.jpg', thumb: 'https://cdn.bsky.app/img/t.jpg' },
              { fullsize: 'http://127.0.0.1/secret.jpg' },
            ],
          },
        },
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('image');
    expect(items[0].url).toBe('https://cdn.bsky.app/img/ok.jpg');
  });

  it('construit une URL blob pour une vidéo', () => {
    const items = parseBlueskyThread({
      thread: {
        post: {
          author: { did: 'did:plc:alice' },
          embed: {
            $type: 'app.bsky.embed.video#view',
            cid: 'bafyvideo',
            thumbnail: 'https://video.bsky.app/thumb.jpg',
            aspectRatio: { width: 1280, height: 720 },
          },
        },
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('video');
    expect(items[0].url).toContain('com.atproto.sync.getBlob');
    expect(items[0].url).toContain('did%3Aplc%3Aalice');
    expect(items[0].quality).toBe('720p');
  });

  it('prend le média d’un recordWithMedia', () => {
    const items = parseBlueskyThread({
      thread: {
        post: {
          author: { did: 'did:plc:alice' },
          embed: {
            $type: 'app.bsky.embed.recordWithMedia#view',
            media: {
              $type: 'app.bsky.embed.images#view',
              images: [{ fullsize: 'https://cdn.bsky.app/quoted.jpg' }],
            },
          },
        },
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://cdn.bsky.app/quoted.jpg');
  });
});
