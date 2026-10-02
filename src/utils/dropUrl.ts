import { detectPlatform } from './linkDetector';

const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;
const BARE_SOCIAL =
  /(?:(?:www\.|old\.|new\.|np\.|m\.)?(?:instagram|threads|tiktok|snapchat|reddit|pinterest)\.com|(?:vm|vt)\.tiktok\.com|(?:www\.)?(?:twitter|x)\.com|(?:bsky\.app|bsky\.social)|(?:www\.)?pinterest\.[a-z.]+|pin\.it|redd\.it)\/[^\s<>"'`]+/gi;

function cleanCandidate(raw: string): string {
  return raw.trim().replace(/[),.;!?]+$/g, '');
}

function firstValid(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const cleaned = cleanCandidate(candidate);
    if (!cleaned) continue;
    if (detectPlatform(cleaned).isValid) return cleaned;
  }
  return null;
}

/** Find the first supported social URL in free-form pasted or dropped text. */
export function extractInputUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (detectPlatform(trimmed).isValid) return trimmed;

  const httpMatches = trimmed.match(URL_IN_TEXT) ?? [];
  const fromHttp = firstValid(httpMatches);
  if (fromHttp) return fromHttp;

  const bareMatches = trimmed.match(BARE_SOCIAL) ?? [];
  return firstValid(bareMatches);
}

export function extractDroppedUrl(dataTransfer: DataTransfer): string | null {
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    const firstLine = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#'));
    if (firstLine) {
      const extracted = extractInputUrl(firstLine);
      if (extracted) return extracted;
    }
  }

  const plain = dataTransfer.getData('text/plain');
  return extractInputUrl(plain);
}
