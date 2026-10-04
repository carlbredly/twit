# twit

Application Vite/React pour télécharger des médias **publics** depuis Instagram, Twitter/X, Snapchat, TikTok, Threads, Bluesky, Reddit, Pinterest, Mastodon et Vimeo.

## Fonctionnalités

- Détection d’URL par hôte réel (pas de lookalikes `evilinstagram.com` / `evilpinterest.com` / `evilmastodon.social` / `evilvimeo.com`)
- Mastodon : statuts publics `/@user/ID` sur les instances allowlistées, API `/api/v1/statuses/{id}` same-host
- Vimeo : vidéos publiques `/ID`, `/video/ID`, `player.vimeo.com/video/ID`, choix de qualité progressive
- Choix de qualité Twitter/X (720p / 360p / 180p) via proxy same-origin
- Historique local (export JSON/CSV, import, filtre texte/plateforme, favoris, suppression)
- Thème clair/sombre, collage, glisser-déposer, `?url=`, partage
- Raccourcis : **Ctrl/⌘+Entrée** pour rechercher, **Échap** pour annuler
- Filtre de sécurité SSRF/XSS : HTTPS, ports 80/443, pas d’identifiants, pas d’IP privées

YouTube n’est pas supporté.

## Scripts

```bash
npm install
npm test
npm run test:security
npm run dev
```
