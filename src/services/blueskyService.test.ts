import { describe, expect, it, vi, afterEach } from 'vitest';
import { downloadBlueskyMedia } from './blueskyService';

describe('downloadBlueskyMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejette une URL invalide', async () => {
    const result = await downloadBlueskyMedia('https://bsky.app/profile/alice.bsky.social');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/i);
  });

  it('extrait un média public', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          thread: {
            post: {
              author: { did: 'did:plc:alice' },
              embed: {
                $type: 'app.bsky.embed.images#view',
                images: [{ fullsize: 'https://cdn.bsky.app/ok.jpg' }],
              },
            },
          },
        }),
      })
    );

    const result = await downloadBlueskyMedia(
      'https://bsky.app/profile/alice.bsky.social/post/3k2abcdef'
    );
    expect(result.success).toBe(true);
    expect(result.mediaItems?.[0].url).toBe('https://cdn.bsky.app/ok.jpg');
  });

  it('signale l’absence de média', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ thread: { post: { author: { did: 'did:plc:alice' } } } }),
      })
    );

    const result = await downloadBlueskyMedia(
      'https://bsky.app/profile/alice.bsky.social/post/3k2abcdef'
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/privée|sans média|supprimé/i);
  });
});
