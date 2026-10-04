import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadMastodonMedia } from './mastodonService';

describe('downloadMastodonMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejette un profil sans statut', async () => {
    const result = await downloadMastodonMedia('https://mastodon.social/@alice');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalide/i);
  });

  it('extrait les médias publics et ignore les URLs internes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://mastodon.social/api/v1/statuses/123456789012345',
        json: async () => ({
          media_attachments: [
            {
              type: 'image',
              url: 'https://files.mastodon.social/ok.jpg',
              preview_url: 'https://files.mastodon.social/thumb.jpg',
              meta: { original: { width: 1200, height: 800 } },
            },
            {
              type: 'image',
              url: 'http://169.254.169.254/secret.jpg',
            },
            {
              type: 'audio',
              url: 'https://files.mastodon.social/clip.mp3',
            },
          ],
        }),
      })
    );

    const result = await downloadMastodonMedia('https://mastodon.social/@alice/123456789012345');
    expect(result.success).toBe(true);
    expect(result.platform).toBe('mastodon');
    expect(result.mediaItems).toHaveLength(1);
    expect(result.mediaItems?.[0].url).toBe('https://files.mastodon.social/ok.jpg');
  });

  it('refuse une redirection vers un autre hôte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://evil.example/steal',
        json: async () => ({
          media_attachments: [{ type: 'image', url: 'https://files.mastodon.social/ok.jpg' }],
        }),
      })
    );

    const result = await downloadMastodonMedia('https://mastodon.social/@alice/123456789012345');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Redirection|non autorisé/i);
  });

  it('signale l’absence de média', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        url: 'https://mastodon.social/api/v1/statuses/123456789012345',
        json: async () => ({ media_attachments: [] }),
      })
    );

    const result = await downloadMastodonMedia('https://mastodon.social/@alice/123456789012345');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/privée|sans média|supprimé/i);
  });
});
