import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoDownloader } from './VideoDownloader';

vi.mock('../services/downloadService', () => ({
  downloadMedia: vi.fn(async () => ({
    success: true,
    mediaItems: [{ url: 'https://cdn.example.com/video.mp4', type: 'video' }],
  })),
  triggerDownload: vi.fn(async () => undefined),
}));

describe('VideoDownloader', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('détecte un lien Twitter valide et active le bouton', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);

    const input = screen.getByLabelText('Lien du média');
    await user.type(input, 'https://x.com/nasa/status/1234567890');

    expect(screen.getByText('Twitter/X détecté')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechercher et télécharger' })).toBeEnabled();
  });

  it('refuse YouTube avec un message explicite', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);

    await user.type(screen.getByLabelText('Lien du média'), 'https://www.youtube.com/watch?v=dQw4w9wgGcI');

    expect(screen.getAllByText(/YouTube n’est pas supporté/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Rechercher et télécharger' })).toBeDisabled();
  });

  it('affiche les médias et permet de copier le lien', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText, readText: vi.fn() },
    });

    render(<VideoDownloader />);
    await user.type(screen.getByLabelText('Lien du média'), 'https://www.tiktok.com/@user/video/1234567890123456789');
    await user.click(screen.getByRole('button', { name: 'Rechercher et télécharger' }));

    expect(await screen.findByText(/Médias trouvés/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copier le lien' }));
    expect(writeText).toHaveBeenCalledWith('https://cdn.example.com/video.mp4');
  });

  it('bascule le thème sombre', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.click(screen.getByLabelText('Changer le thème'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
