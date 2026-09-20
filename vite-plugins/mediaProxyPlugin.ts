import type { Plugin, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MEDIA_PROXY_PATH = '/api/media-proxy';

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

const createMediaProxyMiddleware = (): Connect.NextHandleFunction => {
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
    try {
      const parsedReq = new URL(requestUrl, 'http://localhost');
      targetParam = parsedReq.searchParams.get('url');
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
      // Server-side fetch without browser Origin/Sec-Fetch headers that cause 403.
      const upstream = await fetch(target.href, {
        method: req.method,
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

      const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const contentLength = upstream.headers.get('content-length');

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.setHeader('Access-Control-Allow-Origin', '*');

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
