# Twit — téléchargeur de médias

Application web pour extraire des médias **publics** depuis Instagram, Twitter/X, TikTok et Snapchat Spotlight.

## Fonctionnalités

- Détection stricte de la plateforme (hôte réel, pas un simple motif dans l’URL)
- TikTok (vidéos publiques)
- Historique local des recherches
- Copie du lien média et téléchargement groupé
- Thème clair / sombre
- Filtre de sécurité : blocage XSS (`javascript:`, `data:`), SSRF (localhost, IP privées, metadata cloud) et noms de fichiers dangereux

YouTube est volontairement **non supporté**.

## Scripts

```bash
npm install
npm run dev
npm test
npm run test:security
npm run build
```

## Sécurité

Les URLs utilisateur et les médias renvoyés par les API tierces passent par `src/utils/security.ts` avant tout `fetch` ou téléchargement. Les tests de sécurité vivent dans `src/**/*.test.ts`.
