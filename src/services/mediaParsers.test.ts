import { describe, expect, it } from 'vitest';
import {
  parseFxTwitterResponse,
  parseGenericDownloaderItems,
  parseOEmbedThumbnail,
  parseOpenGraphMedia,
  parseTikTokApiResponse,
  parseVxTwitterResponse,
  parseBlueskyThread,
  parseRedditListing,
  parsePinterestOEmbed,
  parsePinterestPidget,
  parseMastodonStatus,
  parseVimeoPlayerConfig,
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

describe('parseRedditListing', () => {
  it('extrait une vidéo v.redd.it et ignore un aperçu interne', () => {
    const items = parseRedditListing([
      {
        data: {
          children: [
            {
              data: {
                secure_media: {
                  reddit_video: {
                    fallback_url: 'https://v.redd.it/xyz/DASH_360.mp4',
                    width: 640,
                    height: 360,
                  },
                },
                preview: {
                  images: [{ source: { url: 'http://192.168.1.10/x.jpg' } }],
                },
              },
            },
          ],
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: 'https://v.redd.it/xyz/DASH_360.mp4',
      type: 'video',
      quality: '360p',
    });
  });

  it('extrait une galerie et décode &amp;', () => {
    const items = parseRedditListing({
      data: {
        children: [
          {
            data: {
              gallery_data: { items: [{ media_id: 'a' }, { media_id: 'b' }] },
              media_metadata: {
                a: { m: 'image/jpeg', s: { u: 'https://i.redd.it/a.jpg?foo=1&amp;bar=2', x: 100, y: 80 } },
                b: { m: 'image/gif', s: { gif: 'https://i.redd.it/b.gif' } },
              },
            },
          },
        ],
      },
    });
    expect(items).toHaveLength(2);
    expect(items[0].url).toBe('https://i.redd.it/a.jpg?foo=1&bar=2');
    expect(items[1].type).toBe('gif');
  });

  it('suit un crosspost si le post n’a pas de média sûr', () => {
    const items = parseRedditListing([
      {
        data: {
          children: [
            {
              data: {
                crosspost_parent_list: [
                  { url_overridden_by_dest: 'https://i.redd.it/cross.jpg' },
                ],
              },
            },
          ],
        },
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://i.redd.it/cross.jpg');
  });
});

describe('parsePinterestOEmbed', () => {
  it('propose l’originale pinimg et ignore javascript:', () => {
    const items = parsePinterestOEmbed({
      thumbnail_url: 'https://i.pinimg.com/236x/aa/bb/cc/preview.jpg',
      thumbnail_width: 236,
      thumbnail_height: 400,
    });
    expect(items.some((item) => item.url.includes('/originals/'))).toBe(true);
    expect(items.some((item) => item.url.includes('/236x/'))).toBe(true);
    expect(parsePinterestOEmbed({ thumbnail_url: 'javascript:alert(1)' })).toHaveLength(0);
  });
});

describe('parsePinterestPidget', () => {
  it('extrait image originale et vidéo, ignore les hôtes privés', () => {
    const items = parsePinterestPidget({
      data: [
        {
          images: {
            orig: { url: 'https://i.pinimg.com/originals/ok.jpg', width: 1200, height: 1800 },
            '237x': { url: 'http://192.168.1.10/secret.jpg' },
          },
          videos: {
            video_list: {
              V_720P: {
                url: 'https://v1.pinimg.com/videos/mc/720p/ok.mp4',
                width: 720,
                height: 1280,
              },
              V_HLS: { url: 'https://v1.pinimg.com/videos/ok.m3u8' },
            },
          },
        },
      ],
    });
    expect(items.some((item) => item.type === 'image' && item.url.includes('originals'))).toBe(true);
    expect(items.some((item) => item.type === 'video' && item.url.endsWith('.mp4'))).toBe(true);
    expect(items.every((item) => !item.url.includes('192.168'))).toBe(true);
    expect(items.every((item) => !item.url.includes('.m3u8'))).toBe(true);
  });
});

describe('parseMastodonStatus', () => {
  it('extrait image et vidéo, ignore audio et hôtes privés', () => {
    const items = parseMastodonStatus({
      media_attachments: [
        {
          type: 'image',
          url: 'https://files.mastodon.social/ok.jpg',
          preview_url: 'https://files.mastodon.social/thumb.jpg',
          meta: { original: { width: 1200, height: 800 } },
        },
        {
          type: 'gifv',
          url: 'https://files.mastodon.social/anim.mp4',
          meta: { original: { width: 400, height: 400 } },
        },
        {
          type: 'video',
          url: 'http://127.0.0.1/secret.mp4',
        },
        {
          type: 'audio',
          url: 'https://files.mastodon.social/clip.mp3',
        },
        {
          type: 'image',
          url: 'javascript:alert(1)',
        },
      ],
    });
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe('image');
    expect(items[0].url).toBe('https://files.mastodon.social/ok.jpg');
    expect(items[1].type).toBe('gif');
    expect(items.every((item) => !item.url.includes('127.0.0.1'))).toBe(true);
  });
});

describe('parseVimeoPlayerConfig', () => {
  it('extrait les MP4 progressifs triés et ignore HLS / hôtes privés', () => {
    const items = parseVimeoPlayerConfig({
      video: { thumbs: { '640': 'https://i.vimeocdn.com/video/thumb.jpg' } },
      request: {
        files: {
          progressive: [
            {
              quality: '720p',
              width: 1280,
              height: 720,
              url: 'https://vod-progressive.akamaized.net/sd.mp4',
            },
            {
              quality: '1080p',
              width: 1920,
              height: 1080,
              url: 'https://vod-progressive.akamaized.net/hd.mp4',
            },
            {
              quality: 'hls',
              url: 'https://vod-progressive.akamaized.net/master.m3u8',
            },
            {
              quality: '240p',
              url: 'http://169.254.169.254/meta.mp4',
            },
          ],
        },
      },
    });
    expect(items).toHaveLength(2);
    expect(items[0].quality).toBe('1080p');
    expect(items[0].url).toBe('https://vod-progressive.akamaized.net/hd.mp4');
    expect(items[1].quality).toBe('720p');
    expect(items.every((item) => !item.url.includes('169.254'))).toBe(true);
  });

  it('retombe sur la miniature si le flux n’est que HLS/DRM', () => {
    const items = parseVimeoPlayerConfig({
      video: {
        thumbnail_url: 'https://i.vimeocdn.com/video/thumb.jpg',
        width: 1280,
        height: 720,
      },
      request: { files: { progressive: [] } },
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'image',
      url: 'https://i.vimeocdn.com/video/thumb.jpg',
      quality: 'preview',
    });
  });
});
