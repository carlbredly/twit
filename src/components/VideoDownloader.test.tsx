import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoDownloader } from './VideoDownloader';
import { readClipboardText } from '../utils/clipboard';
import { addHistoryEntry } from '../utils/history';

vi.mock('../utils/clipboard', () => ({
  readClipboardText: vi.fn(),
  writeClipboardText: vi.fn().mockResolvedValue(true),
}));

describe('VideoDownloader', () => {
  beforeEach(() => {
    vi.mocked(readClipboardText).mockReset();
  });

  it('affiche le titre, TikTok, Threads, Bluesky, Reddit, Pinterest, Mastodon et Vimeo', () => {
    render(<VideoDownloader />);
    expect(screen.getByRole('heading', { name: /téléchargeur de médias/i })).toBeTruthy();
    expect(screen.getAllByText('TikTok').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Threads').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bluesky').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reddit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pinterest').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mastodon').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vimeo').length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/filtrer par plateforme/i)).toBeTruthy();
    expect(screen.getByText(/favoris seulement/i)).toBeTruthy();
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

  it('détecte un post Bluesky', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://bsky.app/profile/alice.bsky.social/post/3k2abcdef'
    );
    expect(await screen.findByText(/Bluesky détecté/i)).toBeTruthy();
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

  it('détecte un post Reddit', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://www.reddit.com/r/pics/comments/abc12de/sunset'
    );
    expect(await screen.findByText(/Reddit détecté/i)).toBeTruthy();
  });

  it('lance la recherche avec Ctrl+Entrée', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://x.com/user/status/1234567890'
    );
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('détecte un pin Pinterest', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://www.pinterest.com/pin/123456789012'
    );
    expect(await screen.findByText(/Pinterest détecté/i)).toBeTruthy();
  });

  it('détecte un statut Mastodon', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://mastodon.social/@alice/123456789012345'
    );
    expect(await screen.findByText(/Mastodon détecté/i)).toBeTruthy();
  });

  it('détecte une vidéo Vimeo', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(screen.getByLabelText(/lien du média/i), 'https://vimeo.com/123456789');
    expect(await screen.findByText(/Vimeo détecté/i)).toBeTruthy();
  });

  it('refuse un lookalike Vimeo', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(screen.getByLabelText(/lien du média/i), 'https://evilvimeo.com/123456789');
    expect(await screen.findByText(/Plateforme non reconnue/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /rechercher le média/i })).toBeDisabled();
  });

  it('refuse un lookalike Mastodon', async () => {
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.type(
      screen.getByLabelText(/lien du média/i),
      'https://evilmastodon.social/@alice/123456789012345'
    );
    expect(await screen.findByText(/Plateforme non reconnue/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /rechercher le média/i })).toBeDisabled();
  });

  it('ajoute un favori depuis l’historique', async () => {
    addHistoryEntry('https://mastodon.social/@alice/123456789012345', 'mastodon');
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.click(screen.getByRole('button', { name: /ajouter .* aux favoris/i }));
    expect(screen.getByRole('button', { name: /retirer .* des favoris/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('colle un lien depuis le presse-papiers', async () => {
    vi.mocked(readClipboardText).mockResolvedValue('https://x.com/user/status/99');
    const user = userEvent.setup();
    render(<VideoDownloader />);
    await user.click(screen.getByRole('button', { name: /coller/i }));
    expect(await screen.findByText(/Twitter\/X détecté/i)).toBeTruthy();
  });
});
