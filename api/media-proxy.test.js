import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Vercel api/media-proxy', () => {
  const source = readFileSync(resolve('api/media-proxy.js'), 'utf8');

  it('est une Edge Function avec Content-Disposition attachment', () => {
    expect(source).toContain("runtime: 'edge'");
    expect(source).toContain('Content-Disposition');
    expect(source).toContain('attachment;');
    expect(source).toContain('video.twimg.com');
  });

  it('restreint les hôtes au CDN Twitter', () => {
    expect(source).toContain('isAllowedHost');
    expect(source).toContain('.twimg.com');
    expect(source).toContain('Hôte non autorisé');
  });
});
