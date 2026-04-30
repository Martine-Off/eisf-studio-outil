# Studio EISF — Podcast Factory

Transforme les exports Articulate Storyline (.docx) en podcasts pédagogiques audio via IA.

**Version :** 1.3 — Avril 2026  
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
12. [Exports disponibles](#exports-disponibles)
13. [Roadmap](#roadmap)

---

## Vision produit

Studio EISF prend un cours Articulate Storyline exporté en `.docx` et génère automatiquement un dialogue pédagogique entre deux personnages (Inès et Yannick), prêt à être enregistré ou synthétisé en audio TTS. L'utilisateur valide, édite, vérifie la fidélité au source, puis exporte en Word / PDF / JSON.

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
| docx | 9.x | Génération exports Word |
| PDFKit | 0.18 | Génération exports PDF |
| bcrypt | 5.x | Hachage mots de passe |
| jsonwebtoken | 9.x | Auth JWT |
| multer | 1.4 | Upload fichiers |

### IA

Tous les appels de génération transitent par un **webhook n8n** (variable `N8N_WEBHOOK_URL`) qui relaie vers ChatGPT.

La **vérification et correction de fidélité** utilisent directement l'API Anthropic (`ANTHROPIC_API_KEY`) — modèle **claude-opus-4-7** — via un pipeline déterministe en deux étapes (extraction de concepts + vérification binaire).

Un mode mock (`USE_MOCK_AI=true`) court-circuite tous les appels IA avec des réponses prédéfinies, pour développer sans coût.

---

## Architecture

```
[Client React/Vite :5173]
        │  Axios + JWT Bearer
        ▼
[Express API :3001]
        │
        ├── /api/auth        → bcrypt + JWT
        ├── /api/projects    → CRUD projets + import .docx
        ├── /api/ai          → découpage + génération + vérification
        ├── /api/podcasts    → CRUD podcasts + audio TTS
        ├── /api/dialogues   → CRUD répliques
        └── /api/export      → Word / PDF / JSON
        │
        ├── PostgreSQL (pool pg)  ou  Mock DB en mémoire
        ├── uploads/              → .docx uploadés (25 MB max)
        └── n8n webhook           → ChatGPT
```

---

## Installation

### Prérequis

- Node.js 18+
- PostgreSQL 15 (ou `USE_MOCK_DB=true` pour développer sans BDD)
- Instance n8n avec workflow ChatGPT configuré (ou `USE_MOCK_AI=true`)

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

Exécuter le schéma SQL (voir section [Schéma BDD](#schéma-base-de-données)) sur votre instance PostgreSQL, puis renseigner `DATABASE_URL` dans `.env`.

---

## Variables d'environnement

Fichier `server/.env` :

```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/studio_eisf
USE_MOCK_DB=false

# Auth
JWT_SECRET=votre_secret_jwt_long_et_aleatoire

# IA (webhook n8n → ChatGPT)
N8N_WEBHOOK_URL=https://votre-instance-n8n.com/webhook/xxxxx
USE_MOCK_AI=false

# Serveur
PORT=3001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
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
│   │   └── components/
│   │       ├── AppLayout.tsx         — Layout global + navigation
│   │       ├── ProtectedRoute.tsx    — Garde JWT
│   │       ├── WordImport.tsx        — Import fichier .docx
│   │       ├── PodcastEditor.tsx     — Éditeur dialogues + PROPOSITION
│   │       ├── AIVerificationPanel.tsx — Panel vérification fidélité
│   │       ├── GenerateAudioModal.tsx  — Modal génération audio TTS
│   │       ├── ProjectMacroAnalysis.tsx — Analyse macro projet
│   │       └── ProjectPodcasts.tsx   — Liste podcasts d'un projet
│
└── server/
    ├── routes/
    │   ├── index.js                  — Agrégateur de routes
    │   ├── auth.js                   — Inscription / connexion
    │   ├── projects.js               — CRUD projets + upload .docx
    │   ├── ai.js                     — Tous les appels IA
    │   ├── podcasts.js               — CRUD podcasts + audio TTS
    │   ├── dialogues.js              — CRUD répliques
    │   └── export.js                 — Exports Word/PDF/JSON
    ├── utils/
    │   ├── callGPT.js                — Appel webhook n8n → ChatGPT
    │   ├── storylineParser.js        — Parser export Storyline .docx
    │   └── ownershipChecks.js        — Vérifications de propriété
    ├── models/
    │   ├── db.js                     — Connexion PostgreSQL (ou mock)
    │   └── db_mock.js                — Base en mémoire (dev sans BDD)
    ├── middleware/
    │   └── auth.js                   — Vérification JWT
    ├── uploads/                      — Fichiers .docx uploadés
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
                     → rebalanceSegments() fusionne les sections < 350 mots,
                       découpe celles > 1200 mots à la phrase la plus proche

3. CHAPITRES         L'utilisateur voit le découpage proposé, peut modifier les titres
                     Durée cible sélectionnable (4 / 5 / 6 / 7 min)
                     Génération individuelle par chapitre ou globale ("Tout générer")

4. GÉNÉRATION        /ai/generate-single-chapter par chapitre
                     → dialogue Inès/Yannick en JSON
                     → intro et outro EISF ajoutés en dur (textes fixes)
                     → enrichissements IA optionnels marqués [PROPOSITION: ...]

5. VALIDATION        PodcastEditor : bandeau amber si propositions en attente
                     Navigation ◀/▶, actions Garder ou Supprimer par proposition
                     Audio bloqué tant que toutes les PROPOSITION ne sont pas résolues

6. VÉRIFICATION      /ai/auto-verify-and-fix :
                     → compare podcast vs section source du chapitre UNIQUEMENT
                     → boucle max 3 itérations, cible 95% de fidélité
                     → correction automatique des concepts manquants

7. AUDIO             GenerateAudioModal → /podcasts/:id/generate-audio (TTS)

8. EXPORT            Word Studio, Word Lecture, PDF Studio, PDF Lecture, JSON
```

---

## Routes API

### Auth — `/api/auth`

| Méthode | Route | Description |
|---|---|---|
| POST | `/register` | Créer un compte |
| POST | `/login` | Connexion → retourne un JWT |

### Projets — `/api/projects`

| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Lister les projets de l'utilisateur |
| POST | `/create` | Créer un projet + upload .docx (multipart) |
| GET | `/:projectId` | Détail d'un projet + ses podcasts |
| GET | `/:projectId/dialogues` | Tous les dialogues d'un projet |
| DELETE | `/:projectId` | Supprimer un projet |
| POST | `/:id/macro-verify` | Vérification macro globale (score projet) |

### IA — `/api/ai`

| Méthode | Route | Description |
|---|---|---|
| POST | `/preview` | Extraire et découper le contenu source en segments |
| POST | `/generate-single-chapter` | Générer un podcast pour un chapitre |
| POST | `/generate-from-project` | Générer tous les chapitres d'un projet |
| POST | `/regenerate-line` | Reformuler une réplique (simplify/detail/rephrase) |
| POST | `/verify` | Vérifier la fidélité d'un podcast à son chapitre source |
| POST | `/auto-verify-and-fix` | Boucle auto vérification + correction (max 3 passes, cible 95%) |
| POST | `/fix-missing-concepts` | Injecter des concepts manquants dans un podcast |

### Podcasts — `/api/podcasts`

| Méthode | Route | Description |
|---|---|---|
| GET | `/` | Lister tous les podcasts |
| GET | `/:podcastId` | Détail d'un podcast |
| GET | `/:podcastId/dialogues` | Dialogues d'un podcast |
| PUT | `/:podcastId/reorder` | Réordonner les dialogues |
| POST | `/:id/generate-audio` | Générer l'audio TTS |
| POST | `/:id/auto-correct` | Correction automatique |
| GET | `/:id/export-word/:mode` | Export Word (studio/lecture) |

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
| GET | `/word-studio/:podcastId` | Word version studio |
| GET | `/word-lecture/:podcastId` | Word version lecture |
| GET | `/pdf-studio/:podcastId` | PDF version studio |
| GET | `/pdf-lecture/:podcastId` | PDF version lecture |
| GET | `/json/:podcastId` | JSON complet du podcast |

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
    created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(255) NOT NULL,
    source_file_path  TEXT,
    -- Markdown structuré : un titre ## par chapitre Storyline
    cleaned_text      TEXT,
    macro_score       INTEGER,
    macro_feedback    JSONB,
    status            VARCHAR(50) DEFAULT 'draft',
    last_opened_at    TIMESTAMP,
    created_at        TIMESTAMP DEFAULT NOW(),
    updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE podcasts (
    id               SERIAL PRIMARY KEY,
    project_id       INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    title            VARCHAR(255),
    order_index      INTEGER DEFAULT 0,   -- position dans le projet (0-based)
    word_count       INTEGER,
    duration_seconds INTEGER,
    fidelity_score   INTEGER,             -- score vérification IA (0-100)
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dialogues (
    id               SERIAL PRIMARY KEY,
    podcast_id       INTEGER REFERENCES podcasts(id) ON DELETE CASCADE,
    order_index      INTEGER DEFAULT 0,
    character        VARCHAR(50),         -- 'ines' ou 'yannick'
    -- Peut contenir [PROPOSITION: texte] si enrichissement IA non validé
    text_studio      TEXT,
    -- Jamais de [PROPOSITION], version lecture seule
    text_reading     TEXT,
    duration_seconds INTEGER,
    section          VARCHAR(50) DEFAULT 'content', -- jingle/intro/content/conclusion
    created_at       TIMESTAMP DEFAULT NOW()
);
```

**Cascade delete :** `users` → `projects` → `podcasts` → `dialogues`.

`cleaned_text` stocke le Markdown extrait du .docx avec un titre `## Nom du chapitre` par section Storyline. Cette structure permet le découpage gratuit (sans IA) et la vérification ciblée par chapitre.

---

## Personnages IA

| Personnage | Voix | Part | Rôle |
|---|---|---|---|
| **Inès** | Féminine, posée, experte | 70% | Explique les concepts du cours |
| **Yannick** | Masculin, curieux, spontané | 30% | Pose des questions, reformule, fait des liens concrets |

Chaque podcast commence et se termine par des phrases EISF fixes ajoutées en dur côté serveur, indépendamment de la génération IA :

- **Intro** : "Bonjour et bienvenue dans ce podcast de formation EISF..."
- **Outro** : "Ce podcast est une création EISF..."

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
| Word (.docx) | Studio | Dialogue avec indications de jeu, sections colorées |
| Word (.docx) | Lecture | Texte seul, sans instructions studio |
| PDF | Studio | Version studio en PDF |
| PDF | Lecture | Version lecture en PDF |
| JSON | — | Données complètes du podcast (dialogues + métadonnées) |

---

## Roadmap

### V1.3 (actuel — Avril 2026)

- [x] Tags expressifs ElevenLabs dans le prompt (`[vocal smile]`, `[newscaster]`, `[empathetic]`, `[laughs]`)
- [x] Export TXT Speaker 1/2 (format Google AI Studio)
- [x] Vérification IA réécrite : pipeline déterministe Anthropic claude-opus-4-7 (extraction + binaire)
- [x] Score de fidélité corrigé : `concepts présents / total` en % (plus de formule arbitraire)
- [x] `auto-verify-and-fix` accepte `{ podcastId }` et sauvegarde les corrections en BDD
- [x] Bouton "Corriger" masqué tant que l'analyse n'est pas faite
- [x] Helper `anthropicText()` : gestion propre des erreurs API Anthropic
- [x] Typographie : Verdana (police système) remplace Open Sans et Sora — imports Google Fonts supprimés

### V1.2

- [x] Parser Storyline dédié (`storylineParser.js`)
- [x] Rééquilibrage segments (fusion < 350 mots, split > 1200 mots)
- [x] Vérification par chapitre uniquement (pas sur tout le document)
- [x] Système PROPOSITION avec navigation et validation utilisateur
- [x] Durée cible configurable (4 / 5 / 6 / 7 min)
- [x] Génération audio TTS
- [x] Boucle auto-verify-and-fix (cible 95%, max 2 passes)

### V2

- [ ] Sélection voix TTS par personnage
- [ ] Partage de projet et collaboration
- [ ] Templates de styles de podcast
- [ ] Export SCORM
- [ ] Analytics (score moyen, temps de validation)
- [ ] Support multi-formats source (PDF, PPTX)
