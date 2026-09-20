/**
 * Vercel Edge Function — Twitter/X media download proxy (ssstwitter/ssscdn style).
 * Required because static Vercel hosting cannot use Vite middleware / server.mjs.
 */
export const config = {
  runtime: 'edge',
};

const ALLOWED_HOSTS = new Set([
  'video.twimg.com',
  'pbs.twimg.com',
  'ton.twimg.com',
  'abs.twimg.com',
  'amplify.twimg.com',
]);

const isAllowedHost = (hostname) => {
  const host = String(hostname || '').toLowerCase();
  return ALLOWED_HOSTS.has(host) || host.endsWith('.twimg.com');
};

const sanitizeFilename = (name) => {
  const cleaned = String(name || '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
  return cleaned || 'twitter_media.mp4';
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json(405, { error: 'Method not allowed' });
  }

  const incoming = new URL(request.url);
  const targetParam = incoming.searchParams.get('url');
  const filenameParam = incoming.searchParams.get('filename');

  if (!targetParam) {
    return json(400, { error: 'Paramètre url manquant' });
  }

  let target;
  try {
    target = new URL(targetParam);
  } catch {
    return json(400, { error: 'URL cible invalide' });
  }

  if (target.protocol !== 'https:' || !isAllowedHost(target.hostname)) {
    return json(403, { error: 'Hôte non autorisé' });
  }

  try {
    const upstream = await fetch(target.href, {
      headers: {
        Accept: '*/*',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://x.com/',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return json(upstream.status, {
        error: `Échec du téléchargement CDN (${upstream.status})`,
      });
    }

    const finalUrl = new URL(upstream.url);
    if (finalUrl.protocol !== 'https:' || !isAllowedHost(finalUrl.hostname)) {
      return json(502, { error: 'Redirection CDN non autorisée' });
    }

    const filename = sanitizeFilename(
      filenameParam || finalUrl.pathname.split('/').pop() || `twitter_${Date.now()}.mp4`
    );

    const headers = new Headers();
    headers.set('Content-Type', 'application/octet-stream');
    headers.set('Content-Transfer-Encoding', 'binary');
    headers.set('Content-Description', 'File Transfer');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    );
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Content-Type-Options', 'nosniff');

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers });
    }

    // Stream the body (avoids loading whole video in memory / Vercel size traps).
    return new Response(upstream.body, { status: 200, headers });
  } catch (error) {
    return json(502, {
      error: error instanceof Error ? error.message : 'Erreur proxy média',
    });
  }
}
