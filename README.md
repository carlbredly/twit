# twit

Application Vite/React pour télécharger des médias **publics** depuis Instagram, Twitter/X, Snapchat, TikTok, Threads, Bluesky et Reddit.

## Fonctionnalités

- Détection d’URL par hôte réel (pas de lookalikes `evilinstagram.com` / `evilreddit.com`)
- Choix de qualité Twitter/X (720p / 360p / 180p) via proxy same-origin
- Historique local (export JSON/CSV, import, filtre, suppression)
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
