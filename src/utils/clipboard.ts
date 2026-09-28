export async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
    return null;
  }

  try {
    const text = await navigator.clipboard.readText();
    const trimmed = text.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

export async function writeClipboardText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
