import { describe, expect, it } from 'vitest';
import { extractPublicMediaFromHtml } from './snapchatService';

describe('extractPublicMediaFromHtml', () => {
  it('extrait une URL HTTPS publique', () => {
    const html = '{"contentUrl":"https://cf-st.sc-cdn.net/clip.mp4"}';
    expect(extractPublicMediaFromHtml(html)?.url).toBe('https://cf-st.sc-cdn.net/clip.mp4');
  });

  it('ignore une URL interne injectée dans le HTML', () => {
    const html = '{"contentUrl":"https://127.0.0.1/clip.mp4"}';
    expect(extractPublicMediaFromHtml(html)).toBeNull();
  });
});
