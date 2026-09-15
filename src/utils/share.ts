import { detectPlatform } from './linkDetector';

export function buildShareUrl(pageHref: string, mediaUrl: string): string | null {
  const info = detectPlatform(mediaUrl);
  if (!info.isValid) return null;

  try {
    const page = new URL(pageHref);
    page.search = '';
    page.hash = '';
    page.searchParams.set('url', info.canonicalUrl ?? mediaUrl);
    return page.href;
  } catch {
    return null;
  }
}
