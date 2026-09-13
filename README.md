# Twit

Application web pour extraire et télécharger des médias **publics** depuis Instagram, Twitter/X, Snapchat et TikTok.

## Fonctionnalités

- Détection automatique de la plateforme à partir d’un lien
- Support Instagram, Twitter/X, Snapchat et TikTok
- Historique local des recherches
- Téléchargement unitaire ou groupé
- Thème clair / sombre
- Validation des URL et protections contre les schémas dangereux

## Développement

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
npm run lint
npm run build
```

Les tests couvrent la détection de liens, l’historique, le routage des téléchargements et des cas de sécurité (protocoles interdits, hôtes privés, noms de fichiers).
