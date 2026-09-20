import { describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Lightweight stand-in for the Vite media proxy middleware used in integration tests.
 * Mirrors allowlist + "no browser Origin" upstream fetch behavior.
 */
async function startMockCdn() {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const hasOrigin = Boolean(req.headers.origin);
    if (hasOrigin) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Unauthorized.');
      return;
    }
    const body = Buffer.alloc(4096, 9);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', String(body.length));
    res.end(body);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    url: `http://127.0.0.1:${port}/sample.mp4`,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

describe('media proxy behavior (CDN 403 without proxy)', () => {
  it('le CDN mock renvoie 403 avec Origin navigateur et 200 sans Origin', async () => {
    const cdn = await startMockCdn();
    try {
      const blocked = await fetch(cdn.url, {
        headers: { Origin: 'http://localhost:5173' },
      });
      expect(blocked.status).toBe(403);
      const blockedBody = await blocked.text();
      expect(blockedBody.length).toBeLessThan(64);

      const ok = await fetch(cdn.url);
      expect(ok.status).toBe(200);
      const buf = Buffer.from(await ok.arrayBuffer());
      expect(buf.byteLength).toBe(4096);
    } finally {
      await cdn.close();
    }
  });
});
