import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, fetchValidated } from './http';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchValidated', () => {
  it('ne fetch pas un hôte privé', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await fetchValidated('http://127.0.0.1/secret', {}, { httpsOnly: false });
    expect(response).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propage une annulation utilisateur', async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      })
    );

    const pending = fetchValidated('https://example.com/api', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('fetchJson', () => {
  it('parse une réponse JSON HTTPS', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      })
    );
    await expect(fetchJson('https://api.example.com/data')).resolves.toEqual({ ok: true });
  });
});
