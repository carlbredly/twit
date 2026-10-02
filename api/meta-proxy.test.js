import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Vercel api/meta-proxy', () => {
  const source = readFileSync(resolve('api/meta-proxy.js'), 'utf8');

  it('est une Edge Function JSON restreinte à Pinterest', () => {
    expect(source).toContain("runtime: 'edge'");
    expect(source).toContain('pinterest.com');
    expect(source).toContain('/oembed.json');
    expect(source).toContain('/v3/pidgets/pins/info/');
  });

  it('refuse identifiants, ports non 443 et hôtes hors allowlist', () => {
    expect(source).toContain('username');
    expect(source).toContain("port !== '443'");
    expect(source).toContain('Hôte ou chemin non autorisé');
  });
});
