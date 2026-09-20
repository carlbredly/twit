/**
 * Production server (ssstwitter-style):
 * serves the Vite build and proxies Twitter CDN downloads with
 * Content-Disposition: attachment so browsers save real files.
 *
 * Usage: npm run build && npm start
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 4173);
const MEDIA_PROXY_PATH = '/api/media-proxy';

const ALLOWED_HOSTS = new Set([
  'video.twimg.com',
  'pbs.twimg.com',
  'ton.twimg.com',
  'abs.twimg.com',
  'amplify.twimg.com',
]);

const isAllowedHost = (hostname) => {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.has(host) || host.endsWith('.twimg.com');
};

const sanitizeFilename = (name) => {
  const cleaned = String(name || '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
  return cleaned || 'twitter_media.mp4';
};

const contentTypeFor = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.ico': 'image/x-icon',
      '.json': 'application/json',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    }[ext] || 'application/octet-stream'
  );
};

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const handleMediaProxy = async (req, res, requestUrl) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const parsed = new URL(requestUrl, `http://127.0.0.1:${PORT}`);
  const targetParam = parsed.searchParams.get('url');
  const filenameParam = parsed.searchParams.get('filename');

  if (!targetParam) {
    sendJson(res, 400, { error: 'Paramètre url manquant' });
    return;
  }

  let target;
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

    const filename = sanitizeFilename(
      filenameParam ||
        finalUrl.pathname.split('/').pop() ||
        `twitter_${Date.now()}.mp4`
    );

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength === 0) {
      sendJson(res, 502, { error: 'Fichier CDN vide' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Transfer-Encoding': 'binary',
      'Content-Description': 'File Transfer',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, no-store',
      'Access-Control-Allow-Origin': '*',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(buffer);
  } catch (error) {
    sendJson(res, 502, {
      error: error instanceof Error ? error.message : 'Erreur proxy média',
    });
  }
};

const handleStatic = (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.normalize(path.join(DIST, safePath));

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const serve = (fp) => {
    fs.readFile(fp, (err, data) => {
      if (err) {
        // SPA fallback
        fs.readFile(path.join(DIST, 'index.html'), (err2, html) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': contentTypeFor(fp) });
      res.end(data);
    });
  };

  serve(filePath);
};

const server = http.createServer(async (req, res) => {
  const requestUrl = req.url || '/';
  if (requestUrl.startsWith(MEDIA_PROXY_PATH)) {
    await handleMediaProxy(req, res, requestUrl);
    return;
  }
  handleStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`twit server listening on http://127.0.0.1:${PORT}`);
});
