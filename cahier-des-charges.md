# CAHIER DES CHARGES — STUDIO EISF

**Version :** 1.2  
**Date :** 21/04/2026  
**Client :** EISF (École Internationale du Savoir-Faire Français)  
**Chef de projet :** Martine  
**Statut :** En production — V1.2

---

## 1. Vision & objectifs

### 1.1 Problème

Les formateurs EISF produisent des cours sur Articulate Storyline. Ces cours, riches pédagogiquement, ne sont accessibles qu'en e-learning interactif. Il n'existe pas de format audio permettant une consommation nomade (transport, révision légère).

### 1.2 Solution

**Studio EISF** est une application web qui transforme automatiquement un export Storyline (`.docx`) en un ou plusieurs podcasts pédagogiques, sous forme de dialogue entre deux personnages IA. L'utilisateur valide, édite, vérifie la fidélité, génère l'audio, puis exporte.

### 1.3 Objectifs clés

- Fidélité absolue au contenu source (rien d'inventé sans validation)
- Qualité audio et pédagogique (dynamisme, clarté, mémorisation)
- Coût IA minimum (découpage gratuit, vérification ciblée par chapitre)
- Interface intuitive, accessible aux non-développeurs

---

## 2. Formats source supportés

| Format | Méthode d'extraction |
|---|---|
| Export Storyline `.docx` | `storylineParser.js` — table HTML 4 colonnes |

L'export Storyline produit un fichier `.docx` contenant un tableau avec 4 colonnes : ID, Type, Texte d'origine, Traduction. Le parser extrait :
- Les **Nom de la scène** comme délimiteurs de chapitres
- Les **Zone de texte** comme contenu pédagogique
- Ignore les éléments de navigation (Suivant, Précédent, Quiz, Sommaire...)
- Déduplique les lignes (Texte d'origine = Traduction dans les exports mono-langue)
- Détecte le titre réel du chapitre (première ligne courte sans ponctuation finale)

---

## 3. Personnages

| Personnage | Voix | Proportion | Rôle |
|---|---|---|---|
| **Inès** | Féminine, posée, professionnelle | 70% | Experte — explique les concepts |
| **Yannick** | Masculin, curieux, spontané | 30% | Apprenant — pose des questions, reformule, fait des liens |

Règles de génération :
- Inès s'appuie uniquement sur le contenu source (ou signale ses ajouts via `[PROPOSITION: ...]`)
- Yannick pose des questions réelles qu'un apprenant se poserait, pas des questions génériques
- Micro-reformulations intégrées ("donc si je résume...", "attends, tu veux dire que...")

---

## 4. Format du podcast

### 4.1 Structure d'un épisode

```
[INTRO EISF — texte fixe, ajouté en dur]
  Réplique Inès : "Bonjour et bienvenue dans ce podcast de formation EISF..."

[ACCROCHE — générée par IA]
  Relier ce podcast au précédent en 1 phrase

[CONTENU — généré par IA]
  Tout le contenu source transformé
  Quiz intégré naturellement dans le dialogue

[CONCLUSION — générée par IA]
  1 phrase de résumé + 1 annonce du prochain épisode

[OUTRO EISF — texte fixe, ajouté en dur]
  Réplique Inès : "Ce podcast est une création EISF..."
```

### 4.2 Durée cible

Configurable par podcast : **4, 5, 6 ou 7 minutes** (≈ 150 mots/minute de dialogue).

La durée cible est passée à l'IA lors de la génération. Si le contenu source est insuffisant, l'IA complète avec des `[PROPOSITION: ...]` pédagogiquement cohérents (jamais de faits inventés).

### 4.3 Rééquilibrage automatique

Avant génération, les sections Storyline sont rééquilibrées :
- Sections **< 350 mots** → fusionnées avec la suivante (thématiquement)
- Sections **> 1200 mots** → découpées à la frontière de phrase la plus proche du milieu
- Ce rééquilibrage est **gratuit** (aucun appel IA)

---

## 5. Système PROPOSITION

### 5.1 Principe

L'IA ne peut pas inventer de faits. Quand elle souhaite enrichir le dialogue avec du contenu absent du source, elle le marque :

```
[PROPOSITION: exemple concret que j'ajoute pour illustrer le concept]
```

- Cette balise apparaît **uniquement dans `text_studio`**, jamais dans `text_reading`
- L'utilisateur doit valider ou rejeter chaque proposition avant de générer l'audio

### 5.2 Interface de validation

Un bandeau amber apparaît en haut de PodcastEditor si des propositions sont en attente :

```
⚠ 3 propositions à valider  ◀ 2/3 ▶  [✓ Garder]  [✗ Supprimer]  "exemple concret..."
```

- La réplique concernée est mise en évidence (ring amber)
- **Garder** → `[PROPOSITION: texte]` devient `texte`
- **Supprimer** → `[PROPOSITION: texte]` est entièrement supprimé
- La génération audio est **bloquée** tant que des propositions restent non résolues

---

## 6. Vérification de fidélité

### 6.1 Vérification par chapitre

La vérification compare le podcast uniquement contre la **section source de son chapitre** (pas tout le document). Cela évite le faux plafond à 85% causé par les concepts des autres chapitres.

Extraction : `extractSectionByIndex(cleanedText, orderIndex)` — sections délimitées par les titres `##` dans le Markdown stocké en BDD.

### 6.2 Boucle auto-verify-and-fix

- Cible : **95% de fidélité**
- Maximum : **3 itérations**
- Arrêt anticipé si le score stagne ou régresse
- En cas de régression, restaure le meilleur score en BDD
- Concepts corrigés : max 20 par passe (pour contrôler la taille du prompt)

### 6.3 Vérification macro

La route `/projects/:id/macro-verify` analyse la cohérence globale de tous les podcasts d'un projet (couverture, cohérence entre épisodes). Retourne un score sur 100 et une liste d'observations.

---

## 7. Fonctionnalités

### 7.1 Import

- Upload `.docx` (max 25 Mo)
- Validation MIME type + extension
- Extraction automatique via `storylineParser.js`
- Nettoyage : navigation Storyline ignorée, doublons supprimés, artefacts numériques nettoyés
- `cleaned_text` Markdown stocké en BDD (titres `##` par chapitre)

### 7.2 Éditeur (Editor.tsx — 3 étapes)

**Étape 1 — Prévisualisation** : stats du contenu extrait (mots, blocs, chapitres), aperçu des 30 premières lignes.

**Étape 2 — Chapitres** : liste des segments avec titre éditable, nombre de mots, durée estimée. Génération individuelle par chapitre ou globale. Durée cible sélectionnable.

**Étape 3 — Éditeur** : PodcastEditor avec DnD, édition inline, reformulation IA, système PROPOSITION, vérification fidélité.

### 7.3 Génération IA

- Via webhook n8n → ChatGPT (URL configurable dans `.env`)
- Mode mock (`USE_MOCK_AI=true`) pour développer sans coût
- Normalisations audio automatiques : chiffres en lettres, sigles espacés, etc.

### 7.4 Exports

| Format | Mode | Contenu |
|---|---|---|
| Word (.docx) | Studio | Dialogue avec indications de jeu, sections colorées |
| Word (.docx) | Lecture | Texte seul, sans instructions studio |
| PDF | Studio | Version studio en PDF |
| PDF | Lecture | Version lecture en PDF |
| JSON | — | Données complètes (dialogues + métadonnées) |

### 7.5 Audio TTS

Génération audio via la route `/podcasts/:id/generate-audio`. Modal dédiée `GenerateAudioModal.tsx`.

---

## 8. Architecture technique

### 8.1 Stack

| Couche | Technologie |
|---|---|
| Frontend | React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4 |
| Animations | Framer Motion 12 |
| Drag & Drop | @dnd-kit |
| Backend | Node.js 18+, Express 4 |
| Base de données | PostgreSQL 15 (ou mock en mémoire) |
| Auth | JWT + bcrypt |
| Parsing .docx | mammoth 1.8 |
| Export Word | docx 9 |
| Export PDF | PDFKit 0.18 |
| IA | Webhook n8n → ChatGPT |

### 8.2 Structure BDD

```
users → projects → podcasts → dialogues
```

Cascade delete sur toutes les relations. Voir README.md pour le schéma SQL complet.

### 8.3 Variables d'environnement critiques

```env
DATABASE_URL        — Connexion PostgreSQL
JWT_SECRET          — Clé de signature JWT
N8N_WEBHOOK_URL     — URL webhook n8n → ChatGPT
USE_MOCK_AI         — true pour développer sans IA
USE_MOCK_DB         — true pour développer sans PostgreSQL
ALLOWED_ORIGINS     — Origines CORS autorisées
```

---

## 9. Sécurité

- Mots de passe hachés (bcrypt, salt 10)
- JWT expirant, vérifié sur chaque route protégée
- Vérification de propriété sur toutes les ressources (un utilisateur ne peut accéder qu'à ses projets/podcasts)
- Upload : validation MIME + extension + limite 25 Mo
- Noms de fichiers uploadés sanitisés
- CORS restreint aux origines configurées
- Requêtes SQL paramétrées (pas de concaténation)

---

## 10. Identité visuelle

| Élément | Valeur |
|---|---|
| Couleur primaire | `#3465AE` (bleu EISF) |
| Couleur secondaire | `#E63337` (rouge EISF) |
| Couleur accent | `#FEECD7` (beige) |
| Typographie | Système (Tailwind default) |
| Thème | Light / Dark via Tailwind |

---

## 11. Hors périmètre (V1.2)

- Collaboration temps réel multi-utilisateurs
- Partage de projet entre comptes
- Export SCORM
- Templates de style de podcast personnalisables
- Support PDF ou PPTX en source (uniquement .docx Storyline)
- Sélection de voix TTS par personnage

---

## 12. Historique des versions

| Version | Date | Changements |
|---|---|---|
| 1.0 | 11/02/2026 | Version initiale |
| 1.1 | 13/04/2026 | Ajout PodcastEditor, dialogues, podcasts routes |
| 1.2 | 21/04/2026 | Parser Storyline dédié, système PROPOSITION, vérification par chapitre, rééquilibrage segments, personnages Inès/Yannick, IA via n8n |
