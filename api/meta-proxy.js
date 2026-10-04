/**
 * Vercel Edge Function — allowlisted public metadata JSON
 * (Pinterest oEmbed / pidgets, Vimeo player config / oEmbed).
 */
export const config = {
  runtime: 'edge',
};

const MAX_JSON_BYTES = 1_000_000;

const isAllowedMetaUrl = (raw) => {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: 'URL cible invalide' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Seules les URLs HTTPS sont autorisées' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Identifiants dans l’URL interdits' };
  }
  if (parsed.port && parsed.port !== '443') {
    return { ok: false, error: 'Port non autorisé' };
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  const path = parsed.pathname;
  const oembed =
    (host === 'pinterest.com' || host.endsWith('.pinterest.com')) && path.startsWith('/oembed.json');
  const pidgets = host === 'api.pinterest.com' && path.startsWith('/v3/pidgets/pins/info/');
  const vimeoOembed =
    (host === 'vimeo.com' || host === 'www.vimeo.com') && path.startsWith('/api/oembed.json');
  const vimeoConfig = host === 'player.vimeo.com' && /^\/video\/\d{5,}\/config\/?$/.test(path);

  if (!oembed && !pidgets && !vimeoOembed && !vimeoConfig) {
    return { ok: false, error: 'Hôte ou chemin non autorisé pour le proxy métadonnées' };
  }

  return { ok: true, url: parsed };
};

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json(405, { error: 'Method not allowed' });
  }

  const targetParam = new URL(request.url).searchParams.get('url');
  if (!targetParam) {
    return json(400, { error: 'Paramètre url manquant' });
  }

  const allowed = isAllowedMetaUrl(targetParam);
  if (!allowed.ok) {
    return json(403, { error: allowed.error });
  }

  try {
    const upstream = await fetch(allowed.url.href, {
      headers: { Accept: 'application/json' },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return json(upstream.status, { error: `Échec métadonnées (${upstream.status})` });
    }

    const finalCheck = isAllowedMetaUrl(upstream.url);
    if (!finalCheck.ok) {
      return json(502, { error: 'Redirection métadonnées non autorisée' });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType && !/json|javascript/i.test(contentType)) {
      return json(502, { error: 'Réponse métadonnées non JSON' });
    }

    const buffer = new Uint8Array(await upstream.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_JSON_BYTES) {
      return json(502, { error: 'Réponse métadonnées invalide' });
    }

    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder().decode(buffer));
    } catch {
      return json(502, { error: 'JSON métadonnées invalide' });
    }

    if (request.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return json(502, {
      error: error instanceof Error ? error.message : 'Erreur proxy métadonnées',
    });
  }
}
