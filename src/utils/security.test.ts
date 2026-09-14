import { describe, expect, it } from 'vitest';
import {
  coerceToHttpUrl,
  extensionForMediaType,
  isAllowedMediaContentType,
  isBlockedHost,
  MAX_URL_LENGTH,
  parseContentLength,
  sanitizeFilename,
  validatePublicHttpUrl,
} from './security';

describe('validatePublicHttpUrl', () => {
  it('accepte une URL HTTPS publique', () => {
    const result = validatePublicHttpUrl('https://www.instagram.com/p/abc123');
    expect(result.ok).toBe(true);
  });

  it('rejette javascript:', () => {
    const result = validatePublicHttpUrl('javascript:alert(1)');
    expect(result.ok).toBe(false);
  });

  it('rejette data:', () => {
    expect(validatePublicHttpUrl('data:text/html,<script>alert(1)</script>').ok).toBe(false);
  });

  it('rejette file:', () => {
    expect(validatePublicHttpUrl('file:///etc/passwd').ok).toBe(false);
  });

  it('rejette vbscript:', () => {
    expect(validatePublicHttpUrl('vbscript:msgbox(1)').ok).toBe(false);
  });

  it('rejette ftp:', () => {
    expect(validatePublicHttpUrl('ftp://files.example.com/video.mp4').ok).toBe(false);
  });

  it('rejette localhost', () => {
    expect(validatePublicHttpUrl('http://localhost/admin').ok).toBe(false);
  });

  it('rejette 127.0.0.1', () => {
    expect(validatePublicHttpUrl('http://127.0.0.1/ssrf').ok).toBe(false);
  });

  it('rejette 127.1', () => {
    expect(validatePublicHttpUrl('http://127.1/ssrf').ok).toBe(false);
  });

  it('rejette 10.0.0.1', () => {
    expect(validatePublicHttpUrl('http://10.0.0.1/internal').ok).toBe(false);
  });

  it('rejette 192.168.1.1', () => {
    expect(validatePublicHttpUrl('http://192.168.1.1/router').ok).toBe(false);
  });

  it('rejette le metadata cloud 169.254.169.254', () => {
    expect(validatePublicHttpUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false);
  });

  it('rejette CGNAT 100.64.0.1', () => {
    expect(validatePublicHttpUrl('http://100.64.0.1/').ok).toBe(false);
  });

  it('rejette une IPv4 décimale 2130706433', () => {
    expect(validatePublicHttpUrl('http://2130706433/').ok).toBe(false);
  });

  it('rejette [::1]', () => {
    expect(validatePublicHttpUrl('http://[::1]/').ok).toBe(false);
  });

  it('rejette les identifiants dans l’URL', () => {
    expect(validatePublicHttpUrl('https://user:pass@instagram.com/p/abc').ok).toBe(false);
  });

  it('rejette les caractères de contrôle', () => {
    expect(validatePublicHttpUrl('https://example.com/\u0000path').ok).toBe(false);
  });

  it('rejette une URL trop longue', () => {
    expect(validatePublicHttpUrl(`https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`).ok).toBe(false);
  });

  it('rejette http si httpsOnly', () => {
    expect(validatePublicHttpUrl('http://cdn.example.com/video.mp4', { httpsOnly: true }).ok).toBe(false);
  });

  it('accepte http public sans httpsOnly', () => {
    expect(validatePublicHttpUrl('http://cdn.example.com/video.mp4').ok).toBe(true);
  });
});

describe('isBlockedHost', () => {
  it('bloque metadata.google.internal', () => {
    expect(isBlockedHost('metadata.google.internal')).toBe(true);
  });

  it('bloque .local', () => {
    expect(isBlockedHost('printer.local')).toBe(true);
  });

  it('laisse passer un hôte public', () => {
    expect(isBlockedHost('pbs.twimg.com')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('neutralise une traversée de chemin', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('etc-passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('windows-system32');
  });

  it('refuse les noms réservés Windows', () => {
    expect(sanitizeFilename('CON')).toBe('media');
    expect(sanitizeFilename('aux.txt')).toBe('media');
  });

  it('garde un nom simple', () => {
    expect(sanitizeFilename('twitter-123')).toBe('twitter-123');
  });
});

describe('content type et taille', () => {
  it('autorise image/jpeg', () => {
    expect(isAllowedMediaContentType('image/jpeg')).toBe(true);
  });

  it('refuse text/html', () => {
    expect(isAllowedMediaContentType('text/html; charset=utf-8')).toBe(false);
  });

  it('refuse application/javascript', () => {
    expect(isAllowedMediaContentType('application/javascript')).toBe(false);
  });

  it('refuse image/svg+xml', () => {
    expect(isAllowedMediaContentType('image/svg+xml')).toBe(false);
  });

  it('parse Content-Length', () => {
    expect(parseContentLength('1024')).toBe(1024);
    expect(parseContentLength('nope')).toBeNull();
  });

  it('choisit l’extension selon le MIME', () => {
    expect(extensionForMediaType('video', 'video/webm')).toBe('webm');
    expect(extensionForMediaType('image')).toBe('jpg');
  });
});

describe('coerceToHttpUrl', () => {
  it('préfixe https:// si le protocole manque', () => {
    expect(coerceToHttpUrl('instagram.com/p/abc')).toBe('https://instagram.com/p/abc');
  });

  it('ne transforme pas javascript:', () => {
    expect(coerceToHttpUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});
