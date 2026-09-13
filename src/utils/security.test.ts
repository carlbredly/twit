import { describe, expect, it } from 'vitest';
import {
  assertSafeMediaUrl,
  inspectUrlSafety,
  isAllowedMediaContentType,
  isSafeHttpUrl,
  isSafeMediaUrl,
  normalizeInputUrl,
  sanitizeFilename,
} from './security';

describe('inspectUrlSafety / isSafeHttpUrl', () => {
  it('accepte les URLs HTTPS publiques', () => {
    expect(isSafeHttpUrl('https://instagram.com/p/abc')).toBe(true);
    expect(isSafeHttpUrl('https://x.com/user/status/1')).toBe(true);
  });

  it('accepte HTTP public (détection) mais refuse HTTP pour les médias', () => {
    expect(isSafeHttpUrl('http://example.com/file.mp4')).toBe(true);
    expect(isSafeMediaUrl('http://example.com/file.mp4')).toBe(false);
    expect(isSafeMediaUrl('https://cdn.example.com/file.mp4')).toBe(true);
  });

  it('refuse les protocoles dangereux (XSS / exécution locale)', () => {
    const payloads = [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'file:///etc/passwd',
      'blob:https://evil.test/123',
      'vbscript:msgbox(1)',
    ];

    for (const payload of payloads) {
      expect(isSafeHttpUrl(payload), payload).toBe(false);
      expect(inspectUrlSafety(payload).safe).toBe(false);
    }
  });

  it('refuse SSRF vers localhost, metadata cloud et réseaux privés', () => {
    const payloads = [
      'http://127.0.0.1/latest/meta-data',
      'http://localhost:8080/admin',
      'http://[::1]/secret',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.12/internal',
      'http://192.168.1.1/router',
      'http://172.16.0.2/service',
      'http://metadata.google.internal/computeMetadata/v1/',
      'https://localhost/p/abc',
    ];

    for (const payload of payloads) {
      expect(isSafeHttpUrl(payload), payload).toBe(false);
    }
  });

  it('refuse les identifiants dans l’URL', () => {
    expect(isSafeHttpUrl('https://user:pass@example.com/file')).toBe(false);
  });

  it('refuse les URLs vides, trop longues ou avec caractères de contrôle', () => {
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl('https://ok.com/' + 'a'.repeat(3000))).toBe(false);
    expect(isSafeHttpUrl('https://ok.com/\u0000hidden')).toBe(false);
  });

  it('assertSafeMediaUrl lève une erreur sur une cible interne', () => {
    expect(() => assertSafeMediaUrl('http://127.0.0.1/x')).toThrow();
    expect(() => assertSafeMediaUrl('https://cdn.example.com/a.mp4')).not.toThrow();
  });
});

describe('sanitizeFilename', () => {
  it('neutralise la traversée de répertoires', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('/');
  });

  it('retire les caractères interdits Windows', () => {
    expect(sanitizeFilename('a<>:"|?*.txt')).toMatch(/^[\w.-]+$/);
  });

  it('renomme les noms réservés', () => {
    expect(sanitizeFilename('CON')).toBe('file-CON');
    expect(sanitizeFilename('nul')).toBe('file-nul');
  });

  it('fournit un nom par défaut', () => {
    expect(sanitizeFilename('')).toBe('media');
  });
});

describe('normalizeInputUrl', () => {
  it('préfixe https quand le schéma est absent', () => {
    expect(normalizeInputUrl('instagram.com/p/abc')).toBe('https://instagram.com/p/abc');
  });

  it('ne modifie pas un schéma existant', () => {
    expect(normalizeInputUrl('https://x.com/a/status/1')).toBe('https://x.com/a/status/1');
  });
});

describe('isAllowedMediaContentType', () => {
  it('autorise image, video et octet-stream', () => {
    expect(isAllowedMediaContentType('video/mp4')).toBe(true);
    expect(isAllowedMediaContentType('image/jpeg; charset=utf-8')).toBe(true);
    expect(isAllowedMediaContentType('application/octet-stream')).toBe(true);
  });

  it('refuse html, javascript et types vides', () => {
    expect(isAllowedMediaContentType('text/html')).toBe(false);
    expect(isAllowedMediaContentType('application/javascript')).toBe(false);
    expect(isAllowedMediaContentType(null)).toBe(false);
  });
});
