import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoDownloader } from './VideoDownloader';
import { readClipboardText } from '../utils/clipboard';

vi.mock('../utils/clipboard', () => ({
  readClipboardText: vi.fn(),
  writeClipboardText: vi.fn().mockResolvedValue(true),
}));

describe('VideoDownloader', () => {
  beforeEach(() => {
    vi.mocked(readClipboardText).mockReset();
  });

  it('affiche le titre, TikTok et Threads', () => {
    render(<VideoDownloader />);
    expect(screen.getByRole('heading', { name: /téléchargeur de médias/i })).toBeTruthy();
    expect(screen.getByText('TikTok')).toBeTruthy();
    expect(screen.getByText('Threads')).toBeTruthy();
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
    expect(screen.getByRole('button', { name: /rechercher le média/i })).toBeDisabled();
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

  it('détecte un post Threads', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://www.threads.net/@alice/post/Dabc123'
    );
    expect(await screen.findByText(/Threads détecté/i)).toBeTruthy();
  });

  it('efface le champ', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(screen.getByLabelText(/lien du média/i), 'https://x.com/user/status/42');
    await user.click(screen.getByRole('button', { name: /effacer le lien/i }));
    expect(screen.getByLabelText(/lien du média/i)).toHaveValue('');
  });

  it('active le bouton partager pour un lien valide', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    const share = screen.getByRole('button', { name: /partager/i });
    expect(share).toBeDisabled();
    await user.type(screen.getByLabelText(/lien du média/i), 'https://x.com/user/status/42');
    expect(share).not.toBeDisabled();
  });

  it('colle un lien depuis le presse-papiers', async () => {
    vi.mocked(readClipboardText).mockResolvedValue('https://x.com/user/status/99');
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.click(screen.getByRole('button', { name: /coller/i }));
    expect(await screen.findByText(/Twitter\/X détecté/i)).toBeTruthy();
  });
});
