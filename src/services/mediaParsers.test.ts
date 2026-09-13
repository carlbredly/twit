import { describe, expect, it } from 'vitest';
import {
  parseFxTwitterResponse,
  parseGenericDownloaderItems,
  parseTikTokApiResponse,
  parseVxTwitterResponse,
  toSafeMediaUrl,
} from './mediaParsers';

describe('toSafeMediaUrl', () => {
  it('n’accepte que des URL HTTPS publiques', () => {
    expect(toSafeMediaUrl('https://pbs.twimg.com/media/abc.jpg')).toBe(
      'https://pbs.twimg.com/media/abc.jpg'
    );
    expect(toSafeMediaUrl('http://pbs.twimg.com/media/abc.jpg')).toBeNull();
    expect(toSafeMediaUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeMediaUrl('https://127.0.0.1/video.mp4')).toBeNull();
  });
});

describe('parseFxTwitterResponse', () => {
  it('extrait vidéos, photos et GIFs sûrs', () => {
    const items = parseFxTwitterResponse({
      tweet: {
        media: {
          videos: [{ url: 'https://video.twimg.com/a.mp4', thumbnail_url: 'https://pbs.twimg.com/t.jpg' }],
          photos: [{ url: 'https://pbs.twimg.com/p.jpg' }],
          animated_gif: [
            {
              video_info: {
                variants: [
                  { content_type: 'video/mp4', bitrate: 1, url: 'https://video.twimg.com/low.mp4' },
                  { content_type: 'video/mp4', bitrate: 9, url: 'https://video.twimg.com/high.mp4' },
                ],
              },
            },
          ],
        },
      },
    });

    expect(items).toHaveLength(3);
    expect(items[0].type).toBe('video');
    expect(items[2].url).toBe('https://video.twimg.com/high.mp4');
  });

  it('ignore une charge utile malveillante', () => {
    const items = parseFxTwitterResponse({
      tweet: {
        media: {
          videos: [{ url: 'javascript:alert(1)' }],
          photos: [{ url: 'http://169.254.169.254/latest/meta-data' }],
        },
      },
    });
    expect(items).toEqual([]);
  });
});

describe('parseVxTwitterResponse', () => {
  it('lit les variantes vidéo', () => {
    const items = parseVxTwitterResponse({
      media: [
        {
          type: 'video',
          video_info: {
            variants: [{ content_type: 'video/mp4', bitrate: 100, url: 'https://video.twimg.com/v.mp4' }],
          },
        },
      ],
    });
    expect(items[0]?.url).toBe('https://video.twimg.com/v.mp4');
  });
});

describe('parseGenericDownloaderItems', () => {
  it('filtre les items Instagram non sûrs', () => {
    const items = parseGenericDownloaderItems({
      status: 'ok',
      items: [
        { url: 'https://scontent.cdninstagram.com/v.mp4', type: 'video' },
        { url: 'file:///etc/passwd' },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('video');
  });
});

describe('parseTikTokApiResponse', () => {
  it('préfère la version HD et accepte les photos', () => {
    const items = parseTikTokApiResponse({
      code: 0,
      data: {
        hdplay: 'https://v16-webapp.tiktok.com/hd.mp4',
        play: 'https://v16-webapp.tiktok.com/sd.mp4',
        cover: 'https://p16-sign.tiktokcdn.com/cover.jpg',
        images: ['https://p16-sign.tiktokcdn.com/photo1.jpg'],
      },
    });
    expect(items[0].url).toContain('hd.mp4');
    expect(items).toHaveLength(2);
  });

  it('rejette une réponse TikTok invalide', () => {
    expect(parseTikTokApiResponse({ code: 1, data: { play: 'https://v16-webapp.tiktok.com/x.mp4' } })).toEqual([]);
  });
});
