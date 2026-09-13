import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadSnapchatMedia, extractSnapchatToken } from './snapchatService';

describe('extractSnapchatToken', () => {
  it('extrait un token Spotlight/Story', () => {
    expect(extractSnapchatToken('https://www.snapchat.com/spotlight/abc_1')).toBe('abc_1');
    expect(extractSnapchatToken('https://www.snapchat.com/add/user')).toBeNull();
  });
});

describe('downloadSnapchatMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('n’accepte qu’une URL HTTPS extraite du HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('<html><video src="javascript:alert(1)"></video></html>', { status: 200 })
      )
    );

    const result = await downloadSnapchatMedia('https://www.snapchat.com/spotlight/abc');
    expect(result.success).toBe(false);
  });

  it('accepte une contentUrl HTTPS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('{"contentUrl":"https://cf-st.sc-cdn.net/clip.mp4"}', { status: 200 })
      )
    );

    const result = await downloadSnapchatMedia('https://www.snapchat.com/t/abc');
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toContain('sc-cdn.net');
  });
});
