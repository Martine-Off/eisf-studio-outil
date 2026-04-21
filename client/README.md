# Studio EISF — Client

Application React pour la Podcast Factory EISF.

## Démarrage

```bash
npm install
npm run dev     # Vite sur http://localhost:5173
```

## Scripts

```bash
npm run dev       # Serveur de développement
npm run build     # Build production (TypeScript + Vite)
npm run lint      # ESLint
npm run preview   # Prévisualiser le build
```

## Variables d'environnement

Aucune variable côté client. L'API backend tourne sur `http://localhost:3001` (configurable dans les appels Axios).

## Pages

| Page | Route | Description |
|---|---|---|
| Landing | `/` | Accueil public |
| Login | `/login` | Connexion |
| Register | `/register` | Inscription |
| Dashboard | `/dashboard` | Liste des projets |
| Create | `/create` | Nouveau projet |
| Editor | `/project/:id` | Éditeur (prévisualisation → chapitres → éditeur) |

## Stack

React 19 · TypeScript 5.9 · Vite 7 · Tailwind CSS 4 · Framer Motion · @dnd-kit · React Router 7 · Axios · Lucide React
