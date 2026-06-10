# 🎨 Charte Graphique — Studio EISF v2

**Version :** 2.0 — Juin 2026
**Mise à jour par :** Analyse exhaustive du code source (tokens.css, composants TSX, routes export)
**Style général :** Linear/Notion — flat, minimal, aéré, professionnel

> [!NOTE]
> Cette charte remplace la v1 (`charte_graphique_eisf.md`) qui était désynchronisée du code.
> Source de vérité : [`tokens.css`](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/eisf-studio-outil/client/src/styles/tokens.css) + composants du dossier [`client/src`](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/eisf-studio-outil/client/src).

---

## 1. Logo

### 1.1 Variantes disponibles

| Variante | Fichier | Description |
|---|---|---|
| **Icône seule** | `logo-eisf.png` | Logo EISF sans texte — Tour Eiffel stylisée en pixels bleu/blanc/rouge |
| **Icône + texte** | `logo-eisf-2.png` | Logo complet avec libellé « EISF » en dessous |

### 1.2 Règles d'usage dans l'interface

| Contexte | Fichier | Taille | Accompagnement texte |
|---|---|---|---|
| **Header app (desktop/mobile)** | `logo-eisf.png` | `h-7` (28px) | « EISF / Studio » en `font-heading font-bold text-[13px]` |
| **Header landing** | `logo-eisf.png` | `h-9` (36px) | « Studio **EISF** » — « EISF » en bleu `#3465AE` |
| **Formulaire login** | `logo-eisf.png` | `h-8` (32px) | « Studio EISF » en `font-heading font-bold text-lg` |
| **Footer** | `logo-eisf.png` | `h-5` (20px) | « Studio EISF » en `font-heading font-bold text-xs` |

### 1.3 Séparateur logo/texte

Un trait vertical sépare le logo du libellé dans le header app :
```css
width: 1px; height: 1rem; background: var(--border);
```

### 1.4 Zone de protection

Le logo est toujours accompagné d'un gap de `10px` (`gap-2.5`) autour de ses éléments textuels adjacents.

---

## 2. Palette de couleurs

### 2.1 Couleurs fondamentales (design tokens)

Source : [`tokens.css`](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/eisf-studio-outil/client/src/styles/tokens.css)

| Token CSS | Variable courte | Hex | Rôle |
|---|---|---|---|
| `--color-canvas` | `--canvas` | `#FBFCFD` | Fond de page global de l'app |
| `--color-surface` | `--surface` | `#FFFFFF` | Cards, modals, header, surfaces élevées |
| `--color-border` | `--border` | `#EBECEF` | Bordures par défaut |
| `--color-border-soft` | `--border-soft` | `#F2F3F5` | Bordures très légères, fonds de badges neutres |
| `--color-ink` | `--ink` | `#1C1B22` | Texte principal (foreground) |
| `--color-ink-soft` | `--ink-soft` | `#6A6975` | Texte secondaire, labels, descriptions |
| `--color-ink-faint` | `--ink-faint` | `#A3A2AE` | Texte tertiaire, placeholders, métadonnées |
| `--color-primary` | `--primary` | `#2A323C` | Boutons primaires (CTA), avatar, focus ring |

### 2.2 Couleurs personnages

| Token | Variable | Hex | Hex ink | Hex soft | Usage |
|---|---|---|---|---|---|
| `--color-ines` | `--ines` | `#6BB8CD` | `#2C7E97` | `#E4F3F7` | Personnage **Inès** — bordure latérale, nom, indicateurs |
| `--color-yannick` | `--yannick` | `#A973AF` | `#7E4986` | `#F2E9F3` | Personnage **Yannick** — bordure latérale, nom, indicateurs |

> [!IMPORTANT]
> Yannick était historiquement en **rouge** (`#E63337`). Depuis la refonte v2, il est en **mauve/violet** (`#A973AF`). Le rouge subsiste **uniquement dans les exports Word/PDF** (voir section 11).

### 2.3 Couleurs sémantiques

| Token | Variable | Hex (ink) | Usage |
|---|---|---|---|
| `--color-amber` | `--amber` | `#6BB8CD` (`#2C7E97`) | Avertissements, propositions IA, badges « à vérifier » |
| `--color-emerald` | `--emerald` | `#65A30D` (`#365314`) | Succès, validation, score fidélité ≥ seuil |
| `--color-danger` | `--danger` | `#D6475B` (`#A8364A`) | Erreurs, suppression, états destructifs |
| `--color-mauve` | `--mauve` | `#A973AF` | Alias de yannick, badges spéciaux |
| `--color-sky` | `--sky` | `#6BB8CD` | Alias ines/amber pour composants génériques |

### 2.4 Couleurs hardcoded dans les composants (hors tokens)

Ces couleurs apparaissent dans les fichiers TSX mais ne sont pas dans `tokens.css` :

| Hex | Où | Usage |
|---|---|---|
| `#3465AE` | Landing page | **Bleu marine EISF** — boutons CTA, titres, badges, steps, liseré, player |
| `#007BC1` | Landing page | Hover du bleu CTA |
| `#E63337` | Landing page | Liseré tricolore (partie rouge) + pastille mac |
| `#E8E6EA` | Landing page | Bordures, séparateurs, wireframe skeleton |
| `#F5F4F7` | Landing page | Fond section « Comment ça marche », barre mac, mini-player |
| `#5A5963` | Landing + Footer | Texte secondaire (alternative à `--ink-soft`) |
| `#BDD145` | Landing page | Vert anis — pastilles « Sans installation / Export .mp3 », pastille fidélité |
| `#EF804E` | Landing page (step 04) | Orange — icône « Export Audio » |
| `#FECD32` | Landing page | Jaune — halo décoratif hero, pastille mac |
| `#F4F2F5` | PodcastEditor | Fond des répliques « ancre brisée » (ungrounded) |

> [!WARNING]
> La landing page utilise un **jeu de couleurs distinct** des tokens de l'app. Les CTA sont en bleu `#3465AE` (au lieu de `--primary` `#2A323C` dans l'app). C'est intentionnel : la landing cible le marketing, l'app cible l'outil professionnel.

---

## 3. Typographie

### 3.1 Police principale — Application web

| Token | Valeur | Usage |
|---|---|---|
| `--font-heading` | `'Plus Jakarta Sans', system-ui, sans-serif` | Titres, labels prominents, nom de l'app |
| `--font-body` | `'Plus Jakarta Sans', system-ui, sans-serif` | Tout le texte courant, boutons, badges |

- **Source** : Google Fonts — chargée via lien CDN dans `index.html`
- **Antialiasing** : `antialiased` appliqué sur `body`
- **Font features** : `"rlig" 1, "calt" 1`

> [!NOTE]
> Historique : V1.0–V1.2 utilisait Open Sans + Sora. V1.3 est passée à Verdana. V2.0 utilise **Plus Jakarta Sans**.

### 3.2 Graisses utilisées

| Graisse | Tailwind class | Contexte |
|---|---|---|
| **Regular** (400) | `font-normal` | Corps de texte, répliques de dialogue |
| **Medium** (500) | `font-medium` | Labels, boutons, liens, badges |
| **Semibold** (600) | `font-semibold` | Sous-titres, badges importants |
| **Bold** (700) | `font-bold` | Titres (h1-h3), nom de l'app, CTA |

### 3.3 Tailles de texte

| Taille | Tailwind | Usage typique |
|---|---|---|
| `48px / 5xl` | `text-5xl` | Hero h1 (landing, desktop) |
| `36px / 4xl` | `text-4xl` | Hero h1 (landing, mobile) |
| `24px / 2xl` | `text-2xl` | Titre page connexion |
| `18px / lg` | `text-lg` | Titre de card, nom app (login) |
| `16px / base` | `text-base` | Paragraphes principaux, noms features |
| `14px / sm` | `text-sm` | Texte courant, boutons, descriptions |
| `13px` | `text-[13px]` | Texte dialogue dans l'éditeur, nom app header |
| `12px / xs` | `text-xs` | Badges, footer, métadonnées, indicateurs |
| `11px` | `text-[11px]` | Noms de personnages (small caps), pastilles |
| `10px` | `text-[10px]` | Sous-labels, avertissements inline, step counter |
| `9px` | `text-[9px]` | Micro-badges (« Ancre brisée », « Proposition IA ») |

### 3.4 Exports

| Contexte | Police | Tailles |
|---|---|---|
| **Word (.docx)** | Open Sans | 10pt corps, 16pt titre, 14pt sous-titre, 9pt section |
| **PDF** | Helvetica (PDFKit) | 24pt titre, 18pt sous-titre, 14pt lecture, 12pt studio, 10pt métadonnées |

---

## 4. Bordures & Border Radius

### 4.1 Border Radius (tokens)

| Token | Valeur | Usage |
|---|---|---|
| `--radius` | `13px` | Cards, modals, boutons standards, inputs |
| `--radius-lg` | `17px` | Grandes cards, containers, landing cards |
| `--radius-pill` | `9999px` | Badges pill, boutons arrondis, indicateurs ronds |

### 4.2 Radius utilisés dans les composants (Tailwind)

| Classe | Valeur | Usage |
|---|---|---|
| `rounded` | `4px` | Boutons primaires, inputs, petits éléments |
| `rounded-lg` | `8px` | Cards (`Card.tsx`), modals, boutons CTA landing |
| `rounded-xl` | `12px` | Cards steps, dialogues, mini-player |
| `rounded-2xl` | `16px` | Landing feature cards, app mockup |
| `rounded-full` | `9999px` | Avatar, pastilles, badges pills |

### 4.3 Bordures

| Type | Couleur | Usage |
|---|---|---|
| `border-border` | `#EBECEF` | Bordure par défaut (appliquée via `@layer base`) |
| `border-border-soft` | `#F2F3F5` | Bordures très légères |
| `border-[#E8E6EA]` | Landing | Bordures et séparateurs landing page |
| `border-dashed border-border` | — | Zone de drop fichier |
| `border-primary` | `#2A323C` | Drop zone active (drag-over) |
| `border-emerald` | `#65A30D` | Drop zone après upload réussi |
| `border-amber/30` | — | Bandeaux avertissement IA |
| `border-danger/20` | — | Bordure erreur subtile |
| `border-l-[3px] border-ines` | `#6BB8CD` | Barre latérale réplique Inès |
| `border-l-[3px] border-yannick` | `#A973AF` | Barre latérale réplique Yannick |

---

## 5. Ombres

### 5.1 Design tokens

| Token | Valeur | Usage |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(28,27,34,.04)` | Cards légères, header sticky |
| `--shadow-pop` | `0 10px 30px rgba(28,27,34,.12)` | Modals, dropdowns, login card, menus mobiles |

### 5.2 Ombres Tailwind additionnelles

| Classe | Usage |
|---|---|
| `shadow-xl` | Drag-and-drop (carte en déplacement), feature cards hover |
| `shadow-2xl` | Mockup app hero (landing) |

---

## 6. Animations

### 6.1 Keyframes CSS (index.css)

| Animation | Durée | Easing | Description |
|---|---|---|---|
| `fade-in` | 350ms | ease-out | Apparition avec translation Y `+8px → 0` |
| `slide-in` | 250ms | ease-out | Apparition avec translation X `-12px → 0` |
| `accordion-down` | 200ms | ease-out | Ouverture accordéon (`height: 0 → auto`) |
| `accordion-up` | 200ms | ease-out | Fermeture accordéon (`height: auto → 0`) |
| `spin-slow` | ∞ | linear | Rotation continue 360° (chargement) |

### 6.2 Animations Framer Motion

| Composant | Type | Valeurs | Durée |
|---|---|---|---|
| **AppLayout** content | fade + slide Y | `opacity: 0→1, y: 6→0` | 250ms |
| **Login** card | fade + slide Y | `opacity: 0→1, y: 16→0` | 350ms |
| **Create** card | fade + slide Y | `opacity: 0→1, y: 14→0` | 300ms |
| **Landing Hero** (gauche) | fade + slide X | `opacity: 0→1, x: -20→0` | 500ms |
| **Landing Hero** (droite) | fade + slide X | `opacity: 0→1, x: 20→0` | 500ms, delay 150ms |
| **Landing Steps** | fade + slide Y | `opacity: 0→1, y: 12→0` | delay `100ms + 80ms × index` |
| **Landing Features** | fade + slide Y | `opacity: 0→1, y: 12→0` | delay `100ms + 70ms × index` |
| **Stats (Create)** | fade + slide Y | `opacity: 0→1, y: 8→0` | default |
| **Mobile menu backdrop** | fade | `opacity: 0→1` | default |
| **Mobile menu panel** | slide X | `x: 100%→0` | spring: damping 25, stiffness 200 |
| **Bandeaux vérification** | slide Y | `y: -48→0, opacity: 0→1` | default |

### 6.3 Transitions CSS

| Propriété | Durée | Usage |
|---|---|---|
| `transition-colors` | 150ms | Boutons, liens, hover states |
| `transition-all` | 150ms | Inputs (focus), boutons disabled, cards |
| `transition-shadow` | 150ms | Cards features (hover shadow) |
| `active:scale-[0.99]` | — | Micro-feedback au clic sur CTA |

---

## 7. Layout & Spacing

### 7.1 Dimensions globales

| Élément | Valeur |
|---|---|
| **Max-width app** | `1400px` (`max-w-[1400px]` dans AppLayout) |
| **Max-width landing** | `1280px` (`max-w-6xl`) |
| **Max-width éditeur** | `1300px` (`max-w-[1300px]`) |
| **Max-width login** | `380px` |
| **Max-width create** | `640px` (`max-w-2xl`) |
| **Padding horizontal** | `24px` (`px-6`) |
| **Header height** | `56px` (`h-14`) |
| **Content padding top** | `32px` (`py-8`) |

### 7.2 Cards

| Propriété | Valeur (Card.tsx) | Valeur (composants custom) |
|---|---|---|
| **Fond** | `bg-surface` (#FFFFFF) | `bg-surface` |
| **Border** | `border border-border` | `border border-border` ou `border-[#E8E6EA]` |
| **Radius** | `rounded-lg` (8px) | `rounded-xl` (12px) à `rounded-2xl` (16px) |
| **Shadow** | `shadow-card` | `shadow-pop` pour les cards importantes |
| **Padding** | `p-5` (20px) | `p-6` à `p-8` (24–32px) selon le contexte |

---

## 8. Composants UI

### 8.1 Boutons (`Button.tsx`)

| Variante | Style |
|---|---|
| **primary** | `bg-primary text-white hover:opacity-90` |
| **secondary** | `bg-surface border border-border text-ink-soft hover:text-ink` |
| **ghost** | `text-ink-soft hover:bg-black/5` |
| **danger** | `bg-surface border border-danger/30 text-danger hover:bg-danger/10` |

| Taille | Dimensions |
|---|---|
| **sm** | `h-8 px-3 text-[13px]` |
| **md** | `h-9 px-4 text-[14px]` |
| **lg** | `h-10 px-5 text-[15px]` |

Focus ring : `focus-visible:ring-2 focus-visible:ring-primary/40`

### 8.2 Badges (`Badge.tsx`)

Style de base : `rounded-pill border text-[12px] font-medium px-2 py-0.5`

| Tone | Background | Border | Text |
|---|---|---|---|
| **neutral** | `bg-ink/8` | `border-ink/15` | `text-ink-soft` |
| **amber** | `bg-amber/12` | `border-amber/30` | `text-amber-ink` |
| **emerald** | `bg-emerald/12` | `border-emerald/30` | `text-emerald-ink` |
| **danger** | `bg-danger/12` | `border-danger/30` | `text-danger-ink` |
| **ines** | `bg-ines/12` | `border-ines/30` | `text-ines-ink` |
| **yannick** | `bg-yannick/12` | `border-yannick/30` | `text-yannick-ink` |
| **mauve** | `bg-mauve/12` | `border-mauve/30` | `text-yannick-ink` |

### 8.3 Cards (`Card.tsx`)

```
bg-surface border border-border rounded-lg shadow-card
Padding par défaut : p-5 (20px)
```

### 8.4 Modals (`Modal.tsx`)

- **Overlay** : `bg-black/45`
- **Container** : `bg-surface rounded-lg shadow-pop max-w-lg`
- **Fermeture** : touche `Escape` + clic sur overlay

### 8.5 ProgressMeter (`ProgressMeter.tsx`)

Barre de progression avec 3 niveaux :

| Niveau | Couleur barre | Couleur texte | Label |
|---|---|---|---|
| **success** (≥ seuil) | `bg-emerald` | `text-emerald-ink` | « Validé » |
| **warning** (≥ 70%) | `bg-amber` | `text-amber-ink` | « À renforcer » |
| **danger** (< 70%) | `bg-danger` | `text-danger-ink` | « Insuffisant » |

- Barre : `h-[5px] bg-border rounded-pill`
- Marqueur de seuil : `w-[2px] h-[9px] bg-ink-faint`
- Texte : `text-[12px] font-medium font-heading tabular-nums`

### 8.6 Inputs

```
w-full rounded border border-border bg-surface
pl-10 pr-4 py-2.5
text-sm text-ink placeholder:text-ink-faint
focus:ring-2 focus:ring-primary/30 focus:border-primary
```

### 8.7 Dialogue Card (PodcastEditor)

| Élément | Style |
|---|---|
| **Container** | `rounded-xl border bg-surface` |
| **Barre latérale Inès** | `shadow-[inset_3px_0_0_var(--ines)]` |
| **Barre latérale Yannick** | `shadow-[inset_3px_0_0_var(--yannick)]` + `ml-10` (indentation) |
| **Nom personnage** | `font-heading text-[11px] tracking-[.18em] uppercase` |
| **Texte dialogue** | `text-[13px] text-ink leading-relaxed whitespace-pre-wrap` |
| **Proposition IA** | `bg-amber/12 border-amber/30 text-amber-ink rounded px-1.5` |
| **Break tag** | `rounded-pill text-[10px] font-mono border-dashed text-ink-faint` |
| **Réplique ungrounded** | Fond rayé `#F4F2F5` avec `repeating-linear-gradient(135deg, …)` |

---

## 9. Icônes

- **Bibliothèque** : [Lucide React](https://lucide.dev/) (`lucide-react`)

| Contexte | Taille |
|---|---|
| Actions inline (header, boutons) | `h-4 w-4` (16px) |
| Features, stats, zone de drop | `h-5 w-5` (20px) |
| Grande icône (upload, loading) | `h-10 w-10` (40px) |
| Landing steps | `h-4 w-4` dans conteneur `h-9 w-9` |
| Landing features | `h-5 w-5` dans conteneur `h-11 w-11` |
| Menu mobile toggle | `size={20}` |
| Grip handle (drag) | `h-4 w-4` — visible au hover uniquement |

---

## 10. Liseré tricolore (Landing)

Élément identitaire EISF en haut de la landing page :

```
flex h-1 w-full
├── flex-1 bg-[#3465AE]     ← bleu
├── flex-1 bg-white border-y border-[#E8E6EA]  ← blanc
└── flex-1 bg-[#E63337]     ← rouge
```

Représente les couleurs du drapeau français, rappelant l'identité « savoir-faire français » de l'EISF.

---

## 11. Couleurs des exports

### 11.1 Exports Word (.docx)

| Élément | Couleur | Police | Taille |
|---|---|---|---|
| **En-tête tableau** (fond) | `#3465AE` (bleu marine) | Open Sans, blanc, bold | 10pt |
| **Titre document** | `#3465AE` | Open Sans, bold | 16pt |
| **Sous-titre** (nom podcast) | `#3465AE` | Open Sans | 14pt |
| **Nom Inès** | `#3465AE` | Open Sans, bold | 10pt / 11pt |
| **Nom Yannick** | `#E63337` (rouge) | Open Sans, bold | 10pt / 11pt |
| **Bordures tableau** | `#CCCCCC` | — | — |
| **Texte dialogue** | Noir | Open Sans | 10pt studio / 11pt lecture |
| **Section** | Noir | Open Sans, italique | 9pt |

### 11.2 Exports PDF

| Élément | Couleur | Police | Taille |
|---|---|---|---|
| **Titre** | Noir | Helvetica-Bold | 24pt |
| **Sous-titre** | `#3465AE` | Helvetica | 18pt |
| **Nom Inès** | `#3465AE` | Helvetica-Bold | 12pt (studio) / 14pt (lecture) |
| **Nom Yannick** | `#E63337` | Helvetica-Bold | 12pt (studio) / 14pt (lecture) |
| **Durée/section** | Gris | Helvetica-Oblique | 10pt |
| **Texte dialogue** | Noir | Helvetica | 12pt (studio) / 14pt (lecture) |

> [!WARNING]
> **Incohérence personnages** : Dans l'app, Yannick est en **mauve** `#A973AF`. Dans les exports Word/PDF, il reste en **rouge** `#E63337`. Si la charte doit être unifiée, il faudrait mettre à jour [`export.js`](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/eisf-studio-outil/server/routes/export.js) lignes 95, 191, 254, 301.

> [!WARNING]
> **Incohérence typographique** : Le frontend utilise **Plus Jakarta Sans**, les exports Word utilisent **Open Sans**, les exports PDF utilisent **Helvetica** (imposée par PDFKit).

---

## 12. Responsive & Breakpoints

| Breakpoint | Valeur | Comportement |
|---|---|---|
| **Mobile** | `< 768px` | Menu hamburger slide-in, nav masquée, CTA empilés |
| **Tablet** | `≥ 768px` (`md:`) | Nav visible, grille 2 colonnes pour les steps |
| **Desktop** | `≥ 1024px` (`lg:`) | Grille hero 2 colonnes, titres plus grands, 4 colonnes steps |

---

## 13. Résumé visuel rapide

```
┌─────────────────────────────────────────────────┐
│  PALETTE STUDIO EISF v2                         │
│                                                 │
│  ⬛ #2A323C  Ardoise    → Primary/CTA (app)    │
│  🔵 #3465AE  Bleu EISF  → CTA landing/exports │
│  🩵 #6BB8CD  Cyan       → Inès / Amber        │
│  🟣 #A973AF  Mauve      → Yannick / Mauve     │
│  🟢 #65A30D  Émeraude   → Succès/Validé       │
│  🔴 #D6475B  Danger     → Erreurs/Suppr.      │
│  🟡 #BDD145  Vert anis  → Indicateurs landing │
│  🟠 #EF804E  Orange     → Step 04 landing     │
│  ⚪ #FBFCFD  Canvas     → Background app      │
│  ⬜ #FFFFFF  Surface    → Cards/Modals        │
│  🖊️ #1C1B22  Ink        → Texte principal     │
│  📝 #6A6975  Ink-soft   → Texte secondaire    │
│  💤 #A3A2AE  Ink-faint  → Placeholders        │
│                                                 │
│  PERSONNAGES                                    │
│  Inès    → #6BB8CD cyan (app) / #3465AE (exports)│
│  Yannick → #A973AF mauve (app) / #E63337 (exports)│
│                                                 │
│  TYPO: Plus Jakarta Sans (web)                  │
│        Open Sans (Word) / Helvetica (PDF)       │
│  THÈME: Light uniquement                        │
│  STYLE: Linear/Notion (flat, minimal, aéré)     │
└─────────────────────────────────────────────────┘
```
