# Studio EISF

Plateforme de génération de podcasts pédagogiques à partir d'exports Articulate Storyline (.docx).  
Un dialogue audio entre deux personnages IA (Inès & Yannick), éditable, vérifiable et exportable.

**Version :** 1.6 — Juin 2026  
**Auteur :** Martine Desmaroux — [contact@eisf.fr](mailto:contact@eisf.fr)  
**Organisation :** EISF — École Internationale du Savoir-Faire Français

---

## Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | React 19 · TypeScript 5 · Vite 7 · Tailwind CSS 4 · Framer Motion · React Router 7 |
| **Typographie** | Plus Jakarta Sans (Google Fonts) |
| **Backend** | Node.js 18+ · Express 4 · PostgreSQL 15 |
| **Auth** | JWT HttpOnly cookie · CSRF Double Submit · single-auth via `.env` |
| **IA** | Webhook Make (`MAKE_WEBHOOK_URL`) — génération, vérification, correction |
| **Audio TTS** | ElevenLabs (MP3 par réplique, concat ffmpeg) · Gemini TTS (multi-speaker WAV) |
| **Sécurité** | express-rate-limit · CORS configurable · security headers |

---

## Démarrage rapide

### Prérequis

- Node.js 18+
- PostgreSQL 15 (ou `USE_MOCK_DB=true`)
- Webhook Make configuré (ou `USE_MOCK_AI=true`)

### Installation

```bash
# Windows — script automatisé
install-studio.bat

# Démarrage serveur + client
start-studio.bat
```

### Manuellement

```bash
# Backend
cd server && npm install && npm run dev   # :3001

# Frontend
cd client && npm install && npm run dev  # :5173
```

### Variables d'environnement

Copier `server/.env` et renseigner :

```env
PORT=3001
NODE_ENV=development
APP_LOGIN=contact@eisf.fr
APP_PASSWORD=votre_mot_de_passe
JWT_SECRET=votre_secret_jwt
DATABASE_URL=postgresql://user:password@localhost:5432/studio_eisf
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/xxxxxxxx
ELEVENLABS_API_KEY=sk_xxxxxxxxxx
ALLOWED_ORIGINS=http://localhost:5173
```

---

## Documentation

| Document | Contenu |
|---|---|
| [Architecture Technique](docs/Architecture%20Technique.txt) | Architecture détaillée, schéma BDD, routes API |
| [Cahier des charges](docs/cahier-des-charges.md) | Spécifications fonctionnelles |
| [Charte graphique Studio](docs/charte_graphique_STUDIO.md) | Palette EISF, typographie, composants UI (à jour) |
| [Charte graphique v1](docs/charte_graphique_eisf.md) | Ancienne charte (obsolète, conservée pour historique) |
| [Options de déploiement](docs/DEPLOYMENT_OPTIONS.md) | Docker, VPS, Railway, hébergement |
| [Audit de sécurité](docs/SECURITY_AUDIT.md) | Analyse de sécurité et recommandations |
| [Architecture audio](docs/audio_integration_architecture.md) | Pipeline TTS, ffmpeg, ElevenLabs, Gemini |
| [Récap transmission](docs/recap_transmission_projet.md) | Historique et contexte projet |
| [HANDOFF Landing](docs/HANDOFF-Landing.md) | Spécifications refonte landing page |

---

## Licence

Copyright © 2026 EISF — École Internationale du Savoir-Faire Français.  
Tous droits réservés. Voir [LICENSE](./LICENSE).
