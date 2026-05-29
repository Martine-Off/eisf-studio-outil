# Studio EISF — Podcast Factory

Transforme les exports Articulate Storyline (.docx) en podcasts pédagogiques audio via IA.

**Version :** 1.5 — Mai 2026  
**Chef de projet :** Martine  
**Organisation :** EISF (École Internationale du Savoir-Faire Français)

---

## Sommaire

1. [Vision produit](#vision-produit)
2. [Stack technique](#stack-technique)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [Variables d'environnement](#variables-denvironnement)
6. [Structure du projet](#structure-du-projet)
7. [Workflow utilisateur](#workflow-utilisateur)
8. [Routes API](#routes-api)
9. [Schéma base de données](#schéma-base-de-données)
10. [Personnages IA](#personnages-ia)
11. [Système PROPOSITION](#système-proposition)
12. [Grounding Check](#grounding-check)
13. [Exports disponibles](#exports-disponibles)
14. [Sécurité](#sécurité)
15. [Roadmap](#roadmap)

---

## Vision produit

Studio EISF prend un cours Articulate Storyline exporté en `.docx` et génère automatiquement un dialogue pédagogique entre deux personnages (Inès et Yannick), prêt à être enregistré ou synthétisé en audio TTS. L'utilisateur valide, édite, vérifie la fidélité au source, puis exporte en Word / PDF / JSON / TXT.

---

## Stack technique

### Frontend

| Librairie | Version | Rôle |
|---|---|---|
| React | 19.x | UI |
| TypeScript | 5.9 | Typage |
| Vite | 7.x | Bundler |
| Tailwind CSS | 4.x | Styles |
| Framer Motion | 12.x | Animations |
| @dnd-kit | 6.x / 10.x | Drag & Drop dialogues |
| React Router | 7.x | Navigation SPA |
| Axios | 1.x | Requêtes HTTP |
| Lucide React | 0.5x | Icônes |
| **Verdana** | système | Typographie — police système, sans import externe |

### Backend

| Librairie | Version | Rôle |
|---|---|---|
| Node.js | 18+ | Runtime |
| Express | 4.x | Serveur HTTP |
| PostgreSQL | 15 | Base de données |
| pg | 8.x | Driver PostgreSQL |
| mammoth | 1.8 | Conversion .docx → HTML |
| turndown | 7.x | Conversion HTML → Markdown |
| docx | 9.x | Génération exports Word |
| PDFKit | 0.18 | Génération exports PDF |
| date-fns | 4.x | Formatage dates (nommage fichiers export) |
| bcrypt | 5.x | Hachage mots de passe |
| jsonwebtoken | 9.x | Auth JWT |
| multer | 1.4 | Upload fichiers |
| cookie-parser | 1.4 | Parse des cookies (JWT HttpOnly) |
| express-rate-limit | 8.x | Rate limiting (auth, IA, général) |
| express-validator | 7.x | Validation des entrées |
| cors | 2.8 | CORS (origins configurables) |

### IA & Audio

**Toutes** les opérations IA (génération, vérification, correction) transitent par un unique **webhook Make** (variable `MAKE_WEBHOOK_URL`). Le champ `type` de chaque payload permet à Make de router vers le bon scénario via `{{1.type}}` :

| `type` | Usage |
|---|---|
| `generate` | Génération d'un dialogue Inès/Yannick |
| `extract-chapters` | Découpage du .docx en chapitres |
| `regenerate-line` | Reformulation d'une réplique |
| `verify-extract-concepts` | Extraction des concepts du source |
| `verify-check-concepts` | Vérification présent/absent dans le script |
| `fix-missing-concepts` | Injection de concepts manquants |
| `fix-script` | Correction boucle auto-verify |
| `auto-correct` | Auto-correction podcast |
| `macro-evaluate` | Évaluation globale du projet |
| `grounding-check` | Vérification ancrage de chaque réplique dans le source |

**Audio TTS — double moteur :**

| Moteur | Usage | Format | Config |
|---|---|---|---|
| **ElevenLabs** | TTS réplique par réplique (`callElevenLabs.js`) | MP3 | Voix, stabilité, similarité, style, vitesse par personnage via `.env` |
| **Gemini TTS** | TTS multi-speaker en un seul appel (`callGeminiTTS.js`) | WAV (PCM 24kHz → WAV) | Voix Kore/Charon (configurable), vitesse 0.9/1.0/1.1 |

Les MP3 individuels ElevenLabs sont concaténés via **ffmpeg** (`fluent-ffmpeg` + `ffmpeg-static`).

Un mode mock (`USE_MOCK_AI=true`) court-circuite tous les appels IA avec des réponses prédéfinies, pour développer sans coût.

---

## Architecture

```
[Client React/Vite :5173]
        │  Axios + JWT (HttpOnly cookie)
        ▼
[Express API :3001]
        │
        ├── /api/auth        → bcrypt + JWT (cookie HttpOnly + CSRF cookie)
        ├── /api/projects    → CRUD projets + import .docx + renommage + prénoms personnages
        ├── /api/ai          → découpage + génération + vérification + auto-fix
        ├── /api/podcasts    → CRUD podcasts + audio TTS + verify + auto-correct + source
        ├── /api/dialogues   → CRUD répliques + reorder
        └── /api/export      → Word / PDF / JSON (avec blocage si répliques non grounded)
        │
        ├── Middleware : rate limiting, CSRF (prod), validation, security headers
        ├── PostgreSQL (pool pg)  ou  Mock DB en mémoire
        ├── uploads/              → .docx uploadés (25 MB max)
        ├── audio/                → MP3/WAV générés par TTS
        └── Make webhook          → IA (génération, vérification, correction, grounding)
```

---

## Installation

### Prérequis

- Node.js 18+
- PostgreSQL 15 (ou `USE_MOCK_DB=true` pour développer sans BDD)
- Webhook Make configuré avec les scénarios IA (ou `USE_MOCK_AI=true`)

### Scripts d'installation rapide

```bash
# Windows — script automatisé
install-studio.bat     # Installe toutes les dépendances

# Démarrage
start-studio.bat       # Lance serveur + client
```

### Backend

```bash
cd server
npm install
cp .env.example .env   # remplir les variables
npm run dev            # nodemon sur :3001
```

### Frontend

```bash
cd client
npm install
npm run dev            # Vite sur :5173
```

### Base de données

Exécuter le schéma SQL (`server/models/schema.sql`) sur votre instance PostgreSQL, puis renseigner `DATABASE_URL` dans `.env`.

Scripts utilitaires :
- `node server/initDB.js` — Initialise le schéma BDD
- `node server/initUser.js` — Crée un utilisateur initial
- `node server/migrate.js` — Applique les migrations (ajout colonnes, triggers)

---

## Variables d'environnement

Fichier `server/.env` :

```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/studio_eisf
USE_MOCK_DB=false

# Auth
JWT_SECRET=votre_secret_jwt_long_et_aleatoire

# IA (webhook Make — un seul point d'entrée)
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxxxxxx
USE_MOCK_AI=false

# ElevenLabs TTS (réplique par réplique)
ELEVENLABS_API_KEY=sk_xxxxxxxxxx
ELEVENLABS_VOICE_INES=d3AXX0BlgJHYFCuH9X88
ELEVENLABS_STABILITY_INES=0.32
ELEVENLABS_SIMILARITY_INES=0.90
ELEVENLABS_STYLE_INES=0.45
ELEVENLABS_SPEED_INES=1.03
ELEVENLABS_VOICE_YANNICK=jGpnMdbhtKgQbVrYezOx
ELEVENLABS_STABILITY_YANNICK=0.45
ELEVENLABS_SIMILARITY_YANNICK=0.90
ELEVENLABS_STYLE_YANNICK=0.35
ELEVENLABS_SPEED_YANNICK=1.10

# Gemini TTS (optionnel — multi-speaker)
GEMINI_API_KEY=AIzaSyxxxxxxxxxx

# Serveur
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173

# Rate limiting (optionnel — défauts raisonnables)
RATE_LIMIT_WINDOW_MS=900000        # 15 min
RATE_LIMIT_GENERAL_MAX=100
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_AI_MAX=30
```

---

## Structure du projet

```
studio-eisf/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx           — Page d'accueil publique
│   │   │   ├── Login.tsx             — Connexion
│   │   │   ├── Register.tsx          — Inscription
│   │   │   ├── Dashboard.tsx         — Liste des projets
│   │   │   ├── Create.tsx            — Création d'un projet
│   │   │   └── Editor.tsx            — Éditeur principal (3 étapes)
│   │   ├── components/
│   │   │   ├── AppLayout.tsx         — Layout global + navigation
│   │   │   ├── ProtectedRoute.tsx    — Garde JWT
│   │   │   ├── WordImport.tsx        — Import fichier .docx
│   │   │   ├── PodcastEditor.tsx     — Éditeur dialogues + PROPOSITION
│   │   │   ├── AIVerificationPanel.tsx — Panel vérification fidélité
│   │   │   ├── GenerateAudioModal.tsx  — Modal génération audio TTS
│   │   │   ├── ProjectPodcasts.tsx   — Liste podcasts d'un projet
│   │   │   └── ErrorModal.tsx        — Modal d'erreur réutilisable
│   │   ├── context/
│   │   │   └── AuthContext.tsx       — Contexte d'authentification React
│   │   ├── hooks/
│   │   │   └── useKeyboardNav.ts     — Navigation clavier
│   │   ├── lib/
│   │   │   └── utils.ts             — Utilitaires généraux
│   │   ├── types/
│   │   │   └── index.ts             — Types TypeScript partagés
│   │   └── utils/
│   │       └── api.ts               — Instance Axios configurée
│
└── server/
    ├── routes/
    │   ├── index.js                  — Agrégateur de routes
    │   ├── auth.js                   — Inscription / connexion / déconnexion
    │   ├── projects.js               — CRUD projets + upload .docx + prénoms
    │   ├── ai.js                     — Tous les appels IA (génération, vérification, fix)
    │   ├── podcasts.js               — CRUD podcasts + audio TTS + verify + source
    │   ├── dialogues.js              — CRUD répliques
    │   └── export.js                 — Exports Word/PDF/JSON (avec grounding guard)
    ├── utils/
    │   ├── callWebhook.js            — Appel webhook Make (toute l'IA)
    │   ├── callElevenLabs.js         — TTS ElevenLabs (réplique par réplique, MP3)
    │   ├── callGeminiTTS.js          — TTS Gemini multi-speaker (WAV)
    │   ├── storylineParser.js        — Parser export Storyline .docx
    │   ├── extractSourceSection.js   — Extraction section source par order_index
    │   ├── groundingCheck.js         — Vérification ancrage répliques/source
    │   └── ownershipChecks.js        — Vérifications de propriété
    ├── models/
    │   ├── db.js                     — Connexion PostgreSQL (ou mock)
    │   ├── db_mock.js                — Base en mémoire (dev sans BDD)
    │   └── schema.sql                — Schéma SQL complet
    ├── middleware/
    │   ├── auth.js                   — Vérification JWT (header + cookie + query)
    │   ├── csrf.js                   — Protection CSRF Double Submit Cookie (prod)
    │   ├── rateLimiter.js            — Rate limiting (auth / IA / général)
    │   └── validate.js               — Validation express-validator
    ├── audio/                        — Fichiers audio générés (MP3/WAV)
    ├── uploads/                      — Fichiers .docx uploadés
    ├── cron/                         — Jobs planifiés (vide pour l'instant)
    ├── initDB.js                     — Initialisation schéma BDD
    ├── initUser.js                   — Création utilisateur initial
    ├── migrate.js                    — Migrations BDD
    └── server.js                     — Point d'entrée Express
```

---

## Workflow utilisateur

```
1. IMPORT            Upload .docx (export Storyline)
                     → storylineParser.js extrait les scènes (Nom de la scène)
                       et les contenus pédagogiques (Zone de texte)
                     → cleaned_text Markdown structuré stocké en BDD

2. PRÉVISUALISATION  /ai/preview affiche le contenu extrait
                     → rebalanceSegments() fusionne les sections < 780 mots,
                       découpe celles > 1300 mots à la phrase la plus proche

3. CHAPITRES         L'utilisateur voit le découpage proposé, peut modifier les titres
                     Durée fixe : 7 min — targetWords = 7 × 130 = 910 mots
                     Génération individuelle par chapitre ou globale ("Tout générer")

4. GÉNÉRATION        /ai/generate-single-chapter par chapitre
                     → dialogue Inès/Yannick en JSON
                     → intro et outro EISF ajoutés en dur (textes fixes)
                     → enrichissements IA optionnels marqués [PROPOSITION: ...]

5. VALIDATION        PodcastEditor : bandeau amber si propositions en attente
                     Navigation ◀/▶, actions Garder ou Supprimer par proposition
                     Audio bloqué tant que toutes les PROPOSITION ne sont pas résolues

6. VÉRIFICATION      /podcasts/:id/verify :
                     → compare podcast vs section source du chapitre UNIQUEMENT
                     → pipeline déterministe extraction + vérification binaire
                     → score de fidélité (concepts présents / total) en %
                     → si score ≥ 95% : lancement automatique du grounding check

7. GROUNDING         groundingCheck.js (asynchrone après vérification) :
                     → vérifie l'ancrage de chaque réplique dans le source
                     → marque is_grounded = true/false par dialogue
                     → les exports sont bloqués si des répliques sont non grounded

8. AUTO-FIX          /ai/auto-verify-and-fix :
                     → boucle max 3 itérations, cible 95% de fidélité
                     → correction automatique des concepts manquants

9. AUDIO             GenerateAudioModal → /podcasts/:id/generate-audio (ElevenLabs TTS)
                     → génère un MP3 par réplique, concatène avec ffmpeg

10. EXPORT           Word Studio, Word Lecture, PDF Studio, PDF Lecture, JSON, TXT Speaker
```

---

## Routes API

### Auth — `/api/auth`

| Méthode | Route | Description |
|---|---|---|
| POST | `/register` | Créer un compte (validation email + mot de passe 12 car. min) |
| POST | `/login` | Connexion → JWT cookie HttpOnly + CSRF cookie |
| POST | `/logout` | Déconnexion → efface les cookies JWT et CSRF |

### Projets — `/api/projects`

| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Lister les projets de l'utilisateur (+ podcast_count) |
| POST | `/create` | Créer un projet + upload .docx (multipart, 25 MB max) |
| GET | `/:projectId` | Détail d'un projet + ses podcasts |
| GET | `/:projectId/dialogues` | Tous les dialogues d'un projet |
| DELETE | `/:projectId` | Supprimer un projet |
| PATCH | `/:projectId/title` | Renommer un projet |
| PATCH | `/:projectId/character-names` | Modifier les prénoms des personnages (avant génération) |

### IA — `/api/ai`

| Méthode | Route | Description |
|---|---|---|
| POST | `/preview` | Extraire et découper le contenu source en segments |
| POST | `/generate` | Générer un podcast (usage legacy) |
| POST | `/generate-single-chapter` | Générer un podcast pour un chapitre |
| POST | `/generate-from-project` | Générer tous les chapitres d'un projet |
| POST | `/regenerate-line` | Reformuler une réplique (simplify/detail/rephrase) |
| POST | `/verify` | Vérifier la fidélité d'un podcast à son chapitre source |
| POST | `/auto-verify-and-fix` | Boucle auto vérification + correction (max 3 passes, cible 95%) |
| POST | `/fix-missing-concepts` | Injecter des concepts manquants dans un podcast |

### Podcasts — `/api/podcasts`

| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Lister les podcasts d'un projet (`?projectId=`) |
| GET | `/:podcastId` | Détail d'un podcast |
| GET | `/:podcastId/dialogues` | Dialogues d'un podcast |
| PUT | `/:podcastId/reorder` | Réordonner les dialogues |
| PATCH | `/:podcastId/title` | Renommer un podcast |
| DELETE | `/:podcastId` | Supprimer un podcast et ses dialogues |
| GET | `/:id/source-section` | Texte source du chapitre (JSON) |
| GET | `/:id/source` | Page HTML du texte source (nouvel onglet) |
| POST | `/:id/verify` | Vérification IA + grounding check auto |
| POST | `/:id/generate-audio` | Générer l'audio TTS (ElevenLabs, MP3) |
| POST | `/:id/auto-correct` | Correction automatique des concepts manquants |
| GET | `/:id/export-word/:mode` | Export Word (studio/lecture) |
| GET | `/:id/export-txt` | Export TXT format Speaker 1/2 |

### Dialogues — `/api/dialogues`

| Méthode | Route | Description |
|---|---|---|
| PATCH | `/reorder` | Réordonner plusieurs répliques |
| PUT/PATCH | `/:dialogueId` | Modifier une réplique |
| DELETE | `/:dialogueId` | Supprimer une réplique |
| POST | `/` | Créer une réplique |

### Exports — `/api/export`

| Méthode | Route | Description |
|---|---|---|
| GET | `/word-studio/:podcastId` | Word version studio (bloqué si répliques non grounded) |
| GET | `/word-lecture/:podcastId` | Word version lecture (bloqué si répliques non grounded) |
| GET | `/pdf-studio/:podcastId` | PDF version studio (bloqué si répliques non grounded) |
| GET | `/pdf-lecture/:podcastId` | PDF version lecture (bloqué si répliques non grounded) |
| GET | `/json/:podcastId` | JSON complet du podcast (bloqué si répliques non grounded) |

### Système

| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Santé du serveur et de la BDD |

---

## Schéma base de données

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name    VARCHAR(100),
    last_name     VARCHAR(100),
    created_at    TIMESTAMP DEFAULT NOW(),
    last_login    TIMESTAMP
);

CREATE TABLE projects (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title              VARCHAR(255) NOT NULL,
    source_file_path   VARCHAR(500),
    cleaned_text       TEXT,            -- Markdown structuré : un titre ## par chapitre Storyline
    character_1_name   VARCHAR(50),     -- Prénom personnage 1 (défaut: Inès)
    character_2_name   VARCHAR(50),     -- Prénom personnage 2 (défaut: Yannick)
    macro_score        INTEGER,
    macro_feedback     JSONB,
    status             VARCHAR(20) DEFAULT 'draft',
    last_opened_at     TIMESTAMP,
    created_at         TIMESTAMP DEFAULT NOW(),
    updated_at         TIMESTAMP DEFAULT NOW()
);

CREATE TABLE podcasts (
    id               SERIAL PRIMARY KEY,
    project_id       INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL,
    order_index      INTEGER,            -- position dans le projet (0-based)
    word_count       INTEGER,
    duration_seconds INTEGER,
    fidelity_score   DECIMAL(5,2),       -- score vérification IA (0-100)
    ia_feedback      JSONB,              -- concepts manquants, cached_concepts, suggestions
    audio_url        VARCHAR(500),       -- chemin du fichier audio généré
    segment_content  TEXT,               -- contenu source du segment utilisé pour la génération
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chapters (
    id           SERIAL PRIMARY KEY,
    project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    order_index  INTEGER NOT NULL,
    title        VARCHAR(200) NOT NULL,
    content      TEXT NOT NULL,
    word_count   INTEGER,
    podcast_id   INTEGER REFERENCES podcasts(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dialogues (
    id               SERIAL PRIMARY KEY,
    podcast_id       INTEGER REFERENCES podcasts(id) ON DELETE CASCADE,
    order_index      INTEGER NOT NULL,
    character        VARCHAR(50) NOT NULL,    -- 'ines' ou 'yannick'
    text_studio      TEXT NOT NULL,           -- Peut contenir [PROPOSITION: texte]
    text_reading     TEXT NOT NULL,           -- Jamais de [PROPOSITION], version lecture seule
    duration_seconds INTEGER,
    section          VARCHAR(50),             -- jingle/intro/content/conclusion
    is_grounded      BOOLEAN                  -- true/false/null — ancrage vérifié dans le source
);

CREATE TABLE project_shares (
    id                  SERIAL PRIMARY KEY,
    project_id          INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission          VARCHAR(20) DEFAULT 'read_only',
    created_at          TIMESTAMP DEFAULT NOW()
);

-- Triggers auto updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

CREATE TRIGGER update_podcasts_updated_at BEFORE UPDATE ON podcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_project_id ON podcasts(project_id);
CREATE INDEX IF NOT EXISTS idx_dialogues_podcast_id ON dialogues(podcast_id);
```

**Cascade delete :** `users` → `projects` → `podcasts` → `dialogues`.

`cleaned_text` stocke le Markdown extrait du .docx avec un titre `## Nom du chapitre` par section Storyline. Cette structure permet le découpage gratuit (sans IA) et la vérification ciblée par chapitre.

`segment_content` stocke le contenu source spécifique du segment utilisé lors de la génération, permettant une vérification précise même si `cleaned_text` est modifié ultérieurement.

---

## Personnages IA

| Personnage | Voix | Part | Rôle |
|---|---|---|---|
| **Inès** | Féminine, posée, experte | 70% | Explique les concepts du cours |
| **Yannick** | Masculin, curieux, spontané | 30% | Pose des questions, reformule, fait des liens concrets |

Les prénoms sont personnalisables par projet via `PATCH /api/projects/:id/character-names` (avant génération uniquement).

Chaque podcast commence et se termine par des phrases EISF fixes ajoutées en dur côté serveur, indépendamment de la génération IA :

- **Intro** : "Bonjour et bienvenue dans ce podcast de formation EISF..."
- **Outro** : "Ce podcast est une création EISF..."

### Voix ElevenLabs (par défaut)

| Personnage | Voix ID | Stabilité | Similarité | Style | Vitesse |
|---|---|---|---|---|---|
| Inès | `d3AXX0BlgJHYFCuH9X88` | 0.32 | 0.90 | 0.45 | 1.03 |
| Yannick | `jGpnMdbhtKgQbVrYezOx` | 0.45 | 0.90 | 0.35 | 1.10 |

### Voix Gemini TTS (alternative)

| Personnage | Voix par défaut | Voix disponibles |
|---|---|---|
| Inès | Kore | Kore, Aoede, Sadaltager, Zephyr |
| Yannick | Charon | Charon, Fenrir, Orus, Puck |

---

## Système PROPOSITION

Quand l'IA enrichit un dialogue avec du contenu absent du source, elle le marque :

```
[PROPOSITION: exemple concret que j'ajoute pour illustrer]
```

Cette balise n'apparaît **jamais** dans `text_reading`, uniquement dans `text_studio`.

Dans **PodcastEditor**, un bandeau amber s'affiche si des propositions sont en attente :
- Navigation ◀/▶ entre les propositions (toutes répliques confondues)
- **Garder** → remplace `[PROPOSITION: texte]` par `texte`
- **Supprimer** → supprime l'ensemble `[PROPOSITION: texte]`
- La génération audio est **bloquée** tant qu'il reste des propositions non résolues

---

## Grounding Check

Après une vérification atteignant ≥ 95% de fidélité, un **grounding check asynchrone** est déclenché automatiquement :

1. Le webhook Make reçoit le type `grounding-check` avec le texte source et les répliques
2. Chaque réplique est évaluée : `is_grounded = true` (ancrée dans le source) ou `false` (ajoutée par l'IA sans base)
3. Les répliques non grounded sont signalées dans l'éditeur
4. **Les exports (Word, PDF, JSON) sont bloqués** tant que des répliques marquées `is_grounded = false` existent

Ce mécanisme garantit que seul du contenu fidèle au cours source est exporté.

---

## Format du script généré (text_studio)

Chaque réplique dans `text_studio` commence par un **tag expressif** ElevenLabs suivi du texte oral :

```
Speaker 1: [vocal smile] Bonjour et bienvenue dans ce podcast de l'EISF (E.I.S.F.) !
Speaker 2: [empathetic] Euh... j'avais pas pensé à ça, c'est logique !
Speaker 1: [newscaster] La culture du blé remonte au néolithique. <break time="1.5s" />
Speaker 2: [laughs] Ah ouais ! Les boulangers ont eu le temps de peaufiner !
```

| Tag | Locuteur | Contexte |
|---|---|---|
| `[vocal smile]` | Inès | Accueil, ouverture chaleureuse |
| `[newscaster]` | Inès | Explication théorique, définition |
| `[empathetic]` | Inès / Yannick | Encouragement, découverte sincère |
| `[laughs]` | Yannick | Humour, complicité |

Les balises de pause `<break time="0.8s" />` / `<break time="1.5s" />` sont toujours en chiffres (jamais en lettres).

`text_reading` ne contient jamais de tags ni de balises — c'est la version affichée à l'écran.

## Exports disponibles

| Format | Mode | Contenu |
|---|---|---|
| TXT Script API | Speaker 1/2 | Format `Speaker 1: [tag] texte` pour envoi à Google AI Studio |
| Word (.docx) | Studio | Dialogue avec indications de jeu, sections colorées, durées |
| Word (.docx) | Lecture | Texte seul, sans instructions studio |
| PDF | Studio | Version studio en PDF avec couleurs personnage |
| PDF | Lecture | Version lecture en PDF |
| JSON | — | Données complètes du podcast (dialogues + métadonnées + stats) |

**Nommage fichiers export :** `AAMMJJ_TitrePodcast_TitreProjet_type.ext` (via `date-fns`).

**Garde grounding :** Tous les exports vérifient `is_grounded` — si des répliques sont marquées `false`, l'export est bloqué avec un message explicite.

---

## Sécurité

### Authentification

- **JWT HttpOnly cookie** (7 jours) — plus de token en `Authorization` header côté client
- Cookie `token` : `httpOnly: true`, `secure` en production, `sameSite: strict` en production
- Cookie `csrf_token` : `httpOnly: false` (lisible par le JS client)

### Protection CSRF

- **Double Submit Cookie** pattern (production uniquement)
- Le client envoie `X-CSRF-Token` header qui doit correspondre au cookie `csrf_token`
- Méthodes exemptées : GET, HEAD, OPTIONS
- Routes exemptées : `/api/auth/login`, `/api/auth/register`

### Rate Limiting

| Scope | Limite par défaut | Fenêtre |
|---|---|---|
| Général (`/api`) | 100 requêtes | 15 min |
| Auth (`/api/auth`) | 10 requêtes | 15 min |
| IA (`/api/ai`) | 30 requêtes | 15 min |

### Validation des entrées

- `express-validator` pour les champs critiques (email, titres, mots de passe)
- Mot de passe : 12 caractères minimum, 1 majuscule, 1 minuscule, 1 chiffre
- Upload : extension `.docx`/`.doc` + vérification MIME type

### Security Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (production uniquement)
- Redirection HTTP → HTTPS (production uniquement)
- `trust proxy` activé pour lecture de `X-Forwarded-For` derrière Nginx

---

## Copyright

```
Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
Tous droits réservés / All Rights Reserved

Auteur      : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
Organisation: EISF — École Internationale du Savoir Faire Français
Date        : Mars 2026
```

Ce logiciel est la propriété exclusive de l'EISF. Toute reproduction ou utilisation sans autorisation écrite préalable est interdite. Voir le fichier [LICENSE](./LICENSE) pour les conditions complètes.

---

## Roadmap

### V1.5 (actuel — Mai 2026)

- [x] **Grounding check** : vérification ancrage de chaque réplique dans le source après vérification ≥ 95%
- [x] **Blocage export** si répliques `is_grounded = false` (Word, PDF, JSON)
- [x] **Webhook type `grounding-check`** ajouté au routage Make
- [x] **Prénoms personnalisables** par projet (`character_1_name`, `character_2_name`) via API
- [x] **Renommage** projet et podcast via PATCH `/title`
- [x] **Page source HTML** : `/podcasts/:id/source` (consultation nouvel onglet)
- [x] **Route source-section** : `/podcasts/:id/source-section` (JSON API)
- [x] **Suppression de podcast** avec ses dialogues
- [x] **Export TXT** format Speaker 1/2 depuis `/podcasts/:id/export-txt`
- [x] **Nommage fichiers export** normalisé (`AAMMJJ_Titre_Projet_type.ext`)
- [x] **Déconnexion** : route `/auth/logout` efface cookies JWT + CSRF

### V1.4

- [x] Architecture IA unifiée : tout via `MAKE_WEBHOOK_URL` (`callWebhook`), n8n et Anthropic supprimés
- [x] Routage Make par `{{1.type}}` — un seul webhook entrant, 9 types d'opérations
- [x] Rééquilibrage segments : fusion < **780** mots (était 350), split > **1300** mots (était 1200)
- [x] Durée fixe **7 min** côté serveur — `targetWords = 7 × 130 = 910` (n'est plus configurable par l'utilisateur)
- [x] Interface : pills de sélection durée supprimées → badge "~7 min estimées" en lecture seule
- [x] Suppression de réplique dans PodcastEditor (corbeille + confirmation inline)
- [x] Bouton "← Chapitres" permanent dans PodcastEditor et ProjectPodcasts
- [x] Stepper cliquable avec navigation React Router `state` (compatible HashRouter)
- [x] Correction boucle infinie `/api/ai/preview` (`useCallback` + `useRef` garde-fou)

### V1.3

- [x] Tags expressifs ElevenLabs dans le prompt (`[vocal smile]`, `[newscaster]`, `[empathetic]`, `[laughs]`)
- [x] Export TXT Speaker 1/2 (format Google AI Studio)
- [x] Vérification IA : pipeline déterministe extraction + vérification binaire
- [x] Score de fidélité corrigé : `concepts présents / total` en %
- [x] `auto-verify-and-fix` accepte `{ podcastId }` et sauvegarde les corrections en BDD
- [x] Typographie : Verdana (police système) remplace Open Sans et Sora

### V1.2

- [x] Parser Storyline dédié (`storylineParser.js`)
- [x] Rééquilibrage segments (fusion < 350 mots, split > 1200 mots)
- [x] Vérification par chapitre uniquement (pas sur tout le document)
- [x] Système PROPOSITION avec navigation et validation utilisateur
- [x] Durée cible configurable (4 / 5 / 6 / 7 min)
- [x] Génération audio TTS
- [x] Boucle auto-verify-and-fix (cible 95%, max 2 passes)

### V2

- [ ] Sélection voix TTS par personnage (interface utilisateur)
- [ ] Partage de projet et collaboration (table `project_shares` prête)
- [ ] Templates de styles de podcast
- [ ] Export SCORM
- [ ] Analytics (score moyen, temps de validation)
- [ ] Support multi-formats source (PDF, PPTX)
