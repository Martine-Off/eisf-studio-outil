# Déploiement Studio EISF — Plesk

## Stack
- Node.js + Express (backend, port 3001)
- React 18 + Vite (frontend, build statique)
- PostgreSQL (base de données)
- Make.com + Mistral AI (pipeline IA, externe)
- ElevenLabs (TTS, externe)

## 1. Préparer le code
```bash
# Sur la machine de dev
git checkout main
git push origin main

# Créer client/.env avec l'URL de production avant le build
echo "VITE_API_URL=https://votre-domaine.eisf.fr" > client/.env

cd client && npm run build
# Vérifier : 0 erreur, dossier client/dist généré
```

> ⚠️ `VITE_API_URL` est injecté au moment du build — sans cette variable, le lien "Guide utilisateur" de la landing pointera vers `localhost:3001` en production.

## 2. Plesk — Node.js
- Créer une application Node.js
- Document root : pointer vers `client/dist` (frontend statique)
- Application root : pointer vers `server/`
- Fichier de démarrage : `server.js`
- Version Node.js : 18+

## 3. Variables d'environnement (onglet Env Vars dans Plesk)
Copier depuis `server/.env.example` et remplir :

| Variable | Valeur prod |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `ALLOWED_ORIGINS` | `https://votre-domaine.eisf.fr` |
| `APP_LOGIN` | email de connexion |
| `APP_PASSWORD` | mot de passe fort |
| `JWT_SECRET` | générer 96 chars (voir ci-dessous) |
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/eisf_studio` |
| `MAKE_WEBHOOK_URL` | URL Make.com (depuis Make) |
| `ELEVENLABS_API_KEY` | clé ElevenLabs (sk_…) |
| `ELEVENLABS_VOICE_INES` | `d3AXX0BlgJHYFCuH9X88` |
| `ELEVENLABS_VOICE_YANNICK` | `jGpnMdbhtKgQbVrYezOx` |
| `ELEVENLABS_STABILITY_INES` | `0.88` |
| `ELEVENLABS_SIMILARITY_INES` | `0.75` |
| `ELEVENLABS_STYLE_INES` | `0.45` |
| `ELEVENLABS_SPEED_INES` | `0.95` |
| `ELEVENLABS_STABILITY_YANNICK` | `0.72` |
| `ELEVENLABS_SIMILARITY_YANNICK` | `0.75` |
| `ELEVENLABS_STYLE_YANNICK` | `0.35` |
| `ELEVENLABS_SPEED_YANNICK` | `1.00` |
| `USE_MOCK_DB` | `false` |
| `USE_MOCK_AI` | `false` |

⚠️ Ne jamais mettre `NODE_TLS_REJECT_UNAUTHORIZED=0` en prod.

Générer JWT_SECRET :
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Base de données PostgreSQL
- Créer la base `eisf_studio` dans Plesk (PostgreSQL)
- Mettre à jour `DATABASE_URL` avec les credentials Plesk
- Lancer les migrations :
```bash
cd server
node migrate.js      # crée/met à jour les tables
node initDB.js       # initialise les données de base
node initUser.js     # crée l'utilisateur initial (APP_LOGIN / APP_PASSWORD)
```

## 5. Installer les dépendances serveur
```bash
cd server && npm install --production
```

## 6. Redémarrer l'application Node.js dans Plesk

## 7. Tests post-déploiement
- [ ] `https://votre-domaine.eisf.fr` → landing page visible
- [ ] Login avec APP_LOGIN / APP_PASSWORD
- [ ] Créer un projet test
- [ ] Générer un chapitre audio → vérifier MP3
- [ ] Exporter MP3
- [ ] `/health` → `{"status":"OK"}`

## Si ElevenLabs échoue en prod
Erreur `UNABLE_TO_VERIFY_LEAF_SIGNATURE` → proxy Plesk avec inspection TLS.
Ne pas utiliser `NODE_TLS_REJECT_UNAUTHORIZED=0`.
Solution : `NODE_EXTRA_CA_CERTS=/chemin/vers/certificat-racine-proxy.pem`
Contacter l'admin réseau EISF pour obtenir le certificat racine.

## Contacts
- Développement : Martine Desmaroux — contact@eisf.fr
- Direction : Olivier (validation déploiement)
