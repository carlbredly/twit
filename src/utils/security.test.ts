import { describe, expect, it } from 'vitest';
import {
  extensionForMediaType,
  isAllowedMediaContentType,
  isBlockedHost,
  parseContentLength,
  sanitizeFilename,
  validatePublicHttpUrl,
} from './security';

describe('validatePublicHttpUrl', () => {
  it('accepte une URL HTTPS publique', () => {
    const result = validatePublicHttpUrl('https://x.com/user/status/123');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.hostname).toBe('x.com');
    }
  });

  it('rejette les protocoles dangereux', () => {
    expect(validatePublicHttpUrl('javascript:alert(1)').ok).toBe(false);
    expect(validatePublicHttpUrl('data:text/html,<script>alert(1)</script>').ok).toBe(false);
    expect(validatePublicHttpUrl('file:///etc/passwd').ok).toBe(false);
    expect(validatePublicHttpUrl('blob:https://example.com/123').ok).toBe(false);
    expect(validatePublicHttpUrl('ftp://files.example.com/video.mp4').ok).toBe(false);
  });

  it('rejette les hôtes privés et le metadata cloud', () => {
    expect(validatePublicHttpUrl('http://127.0.0.1/secret').ok).toBe(false);
    expect(validatePublicHttpUrl('http://localhost/admin').ok).toBe(false);
    expect(validatePublicHttpUrl('http://10.0.0.8/media').ok).toBe(false);
    expect(validatePublicHttpUrl('http://192.168.1.10/media').ok).toBe(false);
    expect(validatePublicHttpUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false);
    expect(validatePublicHttpUrl('http://[::1]/').ok).toBe(false);
    expect(validatePublicHttpUrl('http://2130706433/').ok).toBe(false);
  });

  it('rejette les identifiants dans l’URL et les caractères de contrôle', () => {
    expect(validatePublicHttpUrl('https://user:pass@x.com/status/1').ok).toBe(false);
    expect(validatePublicHttpUrl('https://x.com/status/1\r\nHost: evil.com').ok).toBe(false);
  });

  it('rejette une URL trop longue', () => {
    const longUrl = `https://x.com/${'a'.repeat(3000)}`;
    expect(validatePublicHttpUrl(longUrl).ok).toBe(false);
  });

  it('peut exiger HTTPS pour les médias', () => {
    expect(validatePublicHttpUrl('http://cdn.example.com/video.mp4', { httpsOnly: true }).ok).toBe(false);
    expect(validatePublicHttpUrl('https://cdn.example.com/video.mp4', { httpsOnly: true }).ok).toBe(true);
  });
});

describe('isBlockedHost', () => {
  it('bloque les suffixes internes', () => {
    expect(isBlockedHost('db.internal')).toBe(true);
    expect(isBlockedHost('printer.local')).toBe(true);
    expect(isBlockedHost('service.localhost')).toBe(true);
  });

  it('autorise un hôte public', () => {
    expect(isBlockedHost('cdn.example.com')).toBe(false);
    expect(isBlockedHost('pbs.twimg.com')).toBe(false);
  });
});

describe('sanitizeFilename', () => {
  it('neutralise la traversée de chemin et les caractères dangereux', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('etc-passwd');
    expect(sanitizeFilename('photo<script>.jpg')).toBe('photo-script-.jpg');
    expect(sanitizeFilename('name with spaces and *?')).toBe('name-with-spaces-and');
  });

  it('fournit un nom par défaut si tout est retiré', () => {
    expect(sanitizeFilename('///')).toBe('media');
    expect(sanitizeFilename('...')).toBe('media');
  });
});

describe('media helpers', () => {
  it('détecte les content-types autorisés', () => {
    expect(isAllowedMediaContentType('video/mp4')).toBe(true);
    expect(isAllowedMediaContentType('image/jpeg; charset=utf-8')).toBe(true);
    expect(isAllowedMediaContentType('text/html')).toBe(false);
    expect(isAllowedMediaContentType('application/javascript')).toBe(false);
  });

  it('lit une taille de contenu valide', () => {
    expect(parseContentLength('1024')).toBe(1024);
    expect(parseContentLength('not-a-number')).toBeNull();
  });

  it('choisit une extension cohérente', () => {
    expect(extensionForMediaType('video', 'video/webm')).toBe('webm');
    expect(extensionForMediaType('image', 'image/png')).toBe('png');
    expect(extensionForMediaType('gif')).toBe('gif');
  });
});
