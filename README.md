# Twit

Application web pour extraire et télécharger des médias **publics** depuis Instagram, Twitter/X, Snapchat et TikTok.

YouTube n’est pas supporté.

## Fonctionnalités

- Détection automatique de la plateforme à partir d’un lien (hôte réel, pas un simple regex)
- Support Instagram, Twitter/X, Snapchat Spotlight et TikTok (y compris liens courts)
- Historique local, export JSON, suppression unitaire
- Filtre par type de média, copie d’URL, téléchargement groupé
- Thème clair / sombre
- Préremplissage via `?url=`
- Validation des URL (XSS, SSRF, hôtes privés, MIME, taille)

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

Les tests couvrent la détection de liens, l’historique, le routage des téléchargements et des cas de sécurité (protocoles interdits, hôtes privés, noms de fichiers).
