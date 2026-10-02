import type { Plugin, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { isAllowedMetaTarget, META_PROXY_PATH } from '../src/utils/metaProxy';

const MAX_JSON_BYTES = 1_000_000;

const sendJson = (res: ServerResponse, status: number, body: Record<string, unknown>) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body));
};

export const createMetaProxyMiddleware = (): Connect.NextHandleFunction => {
  return async (req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    const requestUrl = req.url || '';
    if (!requestUrl.startsWith(META_PROXY_PATH)) {
      next();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    let targetParam: string | null = null;
    try {
      targetParam = new URL(requestUrl, 'http://localhost').searchParams.get('url');
    } catch {
      sendJson(res, 400, { error: 'Requête invalide' });
      return;
    }

    if (!targetParam) {
      sendJson(res, 400, { error: 'Paramètre url manquant' });
      return;
    }

    const allowed = isAllowedMetaTarget(targetParam);
    if (!allowed.ok) {
      sendJson(res, 403, { error: allowed.error });
      return;
    }

    try {
      const upstream = await fetch(allowed.url.href, {
        headers: { Accept: 'application/json' },
        redirect: 'follow',
      });

      if (!upstream.ok) {
        sendJson(res, upstream.status, { error: `Échec métadonnées (${upstream.status})` });
        return;
      }

      const finalCheck = isAllowedMetaTarget(upstream.url);
      if (!finalCheck.ok) {
        sendJson(res, 502, { error: 'Redirection métadonnées non autorisée' });
        return;
      }

      const contentType = upstream.headers.get('content-type') || '';
      if (contentType && !/json|javascript/i.test(contentType)) {
        sendJson(res, 502, { error: 'Réponse métadonnées non JSON' });
        return;
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_JSON_BYTES) {
        sendJson(res, 502, { error: 'Réponse métadonnées invalide' });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(buffer.toString('utf8'));
      } catch {
        sendJson(res, 502, { error: 'JSON métadonnées invalide' });
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(JSON.stringify(parsed));
    } catch (error) {
      sendJson(res, 502, {
        error: error instanceof Error ? error.message : 'Erreur proxy métadonnées',
      });
    }
  };
};

export function metaProxyPlugin(): Plugin {
  return {
    name: 'meta-proxy',
    configureServer(server) {
      server.middlewares.use(createMetaProxyMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMetaProxyMiddleware());
    },
  };
}
