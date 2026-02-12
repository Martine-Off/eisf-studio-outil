# Studio EISF - Podcast Factory

Application full-stack pour générer des podcasts pédagogiques à partir de documents Word, animés par **Anabelle** (experte) et **Bryan** (apprenant).

## Tech Stack
- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: React, Vite, TypeScript, Tailwind CSS
- **AI**: Google Gemini API

## Prérequis
- Node.js 18+
- PostgreSQL (via Docker ou installation locale)
- Clé API Google Gemini

## Installation

1. **Backend**
   ```bash
   cd server
   npm install
   cp .env.example .env # Remplir les variables
   npm run dev
   ```

2. **Frontend**
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Structure
- `/client`: Application React
- `/server`: API Express
- `docker-compose.yml`: Configuration DB (optionnel)

## Fonctionnalités
- Authentification JWT
- Import de fichiers Word (.docx)
- Éditeur de dialogues avec Drag & Drop
- Génération de dialogues par IA
- Export Word (Studio/Lecture) et JSON
