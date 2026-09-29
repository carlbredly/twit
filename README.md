# Twit

Application web pour extraire et télécharger des médias **publics** depuis Instagram, Twitter/X, Snapchat, TikTok et Threads.

YouTube n’est pas supporté.

## Fonctionnalités

- Détection automatique de la plateforme à partir d’un lien (hôte réel, pas un simple regex)
- Support Instagram, Twitter/X, Snapchat Spotlight, TikTok (liens courts `vm` / `vt`) et Threads
- Choix de qualité HD/SD pour Twitter/X, proxy CDN anti-403
- Historique local : export JSON / CSV, import JSON, recherche, suppression unitaire
- Filtre par type de média, copie d’URL, collage presse-papiers, glisser-déposer, lien partageable `?url=`
- Thème clair / sombre (préférence système au premier lancement)
- Annulation d’une recherche en cours, limitation de débit
- Validation des URL (XSS, SSRF, hôtes privés, ports non standards, MIME, taille, paramètres de tracking)

## Développement

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
npm run test:security
npm run lint
npm run build
```

Les tests couvrent la détection de liens, l’historique, le routage des téléchargements et des cas de sécurité (protocoles interdits, hôtes privés, redirections, noms de fichiers).
