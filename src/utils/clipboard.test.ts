import { describe, expect, it, vi } from 'vitest';
import { readClipboardText, writeClipboardText } from './clipboard';

function mockClipboard(partial: {
  readText?: () => Promise<string>;
  writeText?: (text: string) => Promise<void>;
}) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      readText: partial.readText ?? vi.fn(),
      writeText: partial.writeText ?? vi.fn(),
    },
  });
}

describe('clipboard', () => {
  it('lit le texte du presse-papiers', async () => {
    mockClipboard({
      readText: vi.fn().mockResolvedValue('  https://x.com/u/status/1  '),
    });
    await expect(readClipboardText()).resolves.toBe('https://x.com/u/status/1');
  });

  it('écrit dans le presse-papiers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard({ writeText });
    await expect(writeClipboardText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('retourne false si l’API refuse l’écriture', async () => {
    mockClipboard({
      writeText: vi.fn().mockRejectedValue(new Error('denied')),
    });
    await expect(writeClipboardText('hello')).resolves.toBe(false);
  });
});
