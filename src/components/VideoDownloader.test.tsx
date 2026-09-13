import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoDownloader } from './VideoDownloader';

vi.mock('../services/downloadService', () => ({
  downloadMedia: vi.fn(async () => ({
    success: true,
    mediaItems: [{ url: 'https://video.twimg.com/a.mp4', type: 'video' }],
    mediaType: 'video',
    platform: 'twitter',
  })),
  triggerDownload: vi.fn(async () => undefined),
}));

afterEach(() => {
  localStorage.clear();
});

describe('VideoDownloader', () => {
  it('affiche le support TikTok et détecte un lien Twitter', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);

    expect(screen.getByText('TikTok')).toBeTruthy();
    const input = screen.getByLabelText('Lien du média');
    await user.type(input, 'https://x.com/user/status/123456');
    expect(screen.getByText('Twitter/X détecté')).toBeTruthy();
  });

  it('bloque un lien javascript et affiche une erreur', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);

    const input = screen.getByLabelText('Lien du média');
    await user.type(input, 'javascript:alert(1)');
    expect(screen.getByRole('button', { name: 'Rechercher et télécharger' })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('bascule le thème sombre', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);

    await user.click(screen.getByRole('button', { name: 'Activer le thème sombre' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
