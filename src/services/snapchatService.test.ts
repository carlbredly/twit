import { describe, expect, it } from 'vitest';
import { downloadSnapchatMedia, extractPublicMediaFromHtml } from './snapchatService';

describe('downloadSnapchatMedia', () => {
  it('refuse un lien add', async () => {
    const result = await downloadSnapchatMedia('https://www.snapchat.com/add/user');
    expect(result.success).toBe(false);
  });
});

describe('extractPublicMediaFromHtml', () => {
  it('extrait une vidéo HTTPS', () => {
    const item = extractPublicMediaFromHtml(
      '{"contentUrl":"https://cf-st.sc-cdn.net/clip.mp4?token=1"}'
    );
    expect(item?.type).toBe('video');
    expect(item?.url).toContain('https://cf-st.sc-cdn.net/clip.mp4');
  });

  it('ignore une URL interne', () => {
    expect(extractPublicMediaFromHtml('"video_url":"http://127.0.0.1/x.mp4"')).toBeNull();
  });

  it('ignore un HTML trop gros', () => {
    expect(extractPublicMediaFromHtml('a'.repeat(2_000_001))).toBeNull();
  });
});
