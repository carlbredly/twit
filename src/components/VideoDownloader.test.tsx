import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { VideoDownloader } from './VideoDownloader';

describe('VideoDownloader', () => {
  it('affiche le titre et TikTok', () => {
    render(<VideoDownloader />);
    expect(screen.getByRole('heading', { name: /téléchargeur de médias/i })).toBeTruthy();
    expect(screen.getByText('TikTok')).toBeTruthy();
  });

  it('détecte Twitter/X', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://x.com/user/status/1234567890'
    );
    expect(await screen.findByText(/Twitter\/X détecté/i)).toBeTruthy();
  });

  it('refuse javascript:', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(screen.getByLabelText(/lien du média/i), 'javascript:alert(1)');
    expect(await screen.findByText(/Protocole non autorisé/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /rechercher et télécharger/i })).toBeDisabled();
  });

  it('refuse YouTube', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(await screen.findByText(/YouTube n’est pas supporté/i)).toBeTruthy();
  });

  it('bascule le thème', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.click(screen.getByRole('button', { name: /thème sombre/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('détecte un lien TikTok court', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(screen.getByLabelText(/lien du média/i), 'https://vm.tiktok.com/ZMabcdef/');
    expect(await screen.findByText(/TikTok détecté/i)).toBeTruthy();
  });

  it('active le bouton partager pour un lien valide', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    const share = screen.getByRole('button', { name: /partager/i });
    expect(share).toBeDisabled();
    await user.type(screen.getByLabelText(/lien du média/i), 'https://x.com/user/status/42');
    expect(share).not.toBeDisabled();
  });
});
