import type { Plugin, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const MEDIA_PROXY_PATH = '/api/media-proxy';

const ALLOWED_HOST_SUFFIX = '.twimg.com';
const ALLOWED_HOSTS = new Set([
  'video.twimg.com',
  'pbs.twimg.com',
  'ton.twimg.com',
  'abs.twimg.com',
  'amplify.twimg.com',
]);

const isAllowedHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.has(host) || host.endsWith(ALLOWED_HOST_SUFFIX);
};

const sendJson = (res: ServerResponse, status: number, body: Record<string, string>) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

const sanitizeFilename = (name: string): string => {
  const cleaned = name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(0, 120);
  return cleaned || 'twitter_media';
};

const guessFilename = (target: URL, requested: string | null): string => {
  if (requested) {
    const base = sanitizeFilename(requested);
    if (/\.(mp4|jpg|jpeg|png|webp|gif|webm)$/i.test(base)) return base;
    if (target.pathname.includes('.mp4')) return `${base}.mp4`;
    if (/\.(jpe?g|png|webp|gif)$/i.test(target.pathname)) {
      const ext = target.pathname.split('.').pop() || 'jpg';
      return `${base}.${ext}`;
    }
    return `${base}.mp4`;
  }
  const last = target.pathname.split('/').pop() || 'twitter_media.mp4';
  return sanitizeFilename(last.includes('.') ? last : `${last}.mp4`);
};

/**
 * Same-origin media proxy modeled after ssstwitter/ssscdn:
 * streams Twitter CDN bytes with Content-Disposition: attachment
 * so the browser saves a real non-empty file.
 */
export const createMediaProxyMiddleware = (): Connect.NextHandleFunction => {
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const requestUrl = req.url || '';
    if (!requestUrl.startsWith(MEDIA_PROXY_PATH)) {
      next();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    let targetParam: string | null = null;
    let filenameParam: string | null = null;
    try {
      const parsedReq = new URL(requestUrl, 'http://localhost');
      targetParam = parsedReq.searchParams.get('url');
      filenameParam = parsedReq.searchParams.get('filename');
    } catch {
      sendJson(res, 400, { error: 'Requête invalide' });
      return;
    }

    if (!targetParam) {
      sendJson(res, 400, { error: 'Paramètre url manquant' });
      return;
    }

    let target: URL;
    try {
      target = new URL(targetParam);
    } catch {
      sendJson(res, 400, { error: 'URL cible invalide' });
      return;
    }

    if (target.protocol !== 'https:' || !isAllowedHost(target.hostname)) {
      sendJson(res, 403, { error: 'Hôte non autorisé' });
      return;
    }

    try {
      const upstream = await fetch(target.href, {
        method: 'GET',
        headers: {
          Accept: '*/*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://x.com/',
        },
        redirect: 'follow',
      });

      if (!upstream.ok) {
        sendJson(res, upstream.status, {
          error: `Échec du téléchargement CDN (${upstream.status})`,
        });
        return;
      }

      const finalUrl = new URL(upstream.url);
      if (finalUrl.protocol !== 'https:' || !isAllowedHost(finalUrl.hostname)) {
        sendJson(res, 502, { error: 'Redirection CDN non autorisée' });
        return;
      }

      const upstreamType = upstream.headers.get('content-type') || 'application/octet-stream';
      const contentLength = upstream.headers.get('content-length');
      const filename = guessFilename(finalUrl, filenameParam);

      // Match ssscdn behavior: force a file download in the browser.
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Transfer-Encoding', 'binary');
      res.setHeader('Content-Description', 'File Transfer');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Allow-Origin', '*');
      // Keep original type for debugging / clients that care.
      res.setHeader('X-Upstream-Content-Type', upstreamType);

      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.byteLength === 0) {
        sendJson(res, 502, { error: 'Fichier CDN vide' });
        return;
      }

      res.setHeader('Content-Length', String(buffer.byteLength));
      res.end(buffer);
    } catch (error) {
      sendJson(res, 502, {
        error: error instanceof Error ? error.message : 'Erreur proxy média',
      });
    }
  };
};

export function mediaProxyPlugin(): Plugin {
  return {
    name: 'media-proxy',
    configureServer(server) {
      server.middlewares.use(createMediaProxyMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMediaProxyMiddleware());
    },
  };
}
