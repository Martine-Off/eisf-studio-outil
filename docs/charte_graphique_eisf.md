# 🎨 Charte Graphique — Studio EISF

**Inventaire complet** de toutes les informations de design trouvées dans le projet.

> [!NOTE]
> Sources analysées : [index.css](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/EISF%20Studio/4%20Antigravity%20EISF%20Studio/client/src/index.css), [cahier-des-charges.md](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/EISF%20Studio/4%20Antigravity%20EISF%20Studio/cahier-des-charges.md), [export.js](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/EISF%20Studio/4%20Antigravity%20EISF%20Studio/server/routes/export.js), et tous les composants TSX.

---

## 1. Palette de couleurs EISF

### 1.1 Palette officielle (design tokens dans `index.css`)

| Token CSS | Hex | Nom | Rôle |
|---|---|---|---|
| `--color-eisf-red` | `#D6475B` | **Rouge EISF** | Couleur primaire, boutons CTA, accents, logo badge, erreurs |
| `--color-eisf-cyan` | `#6BB8CD` | **Cyan EISF** | Couleur secondaire, info, icônes stats, indicateurs |
| `--color-eisf-green` | `#BDD145` | **Vert anis EISF** | Accent/succès, fidélité, upload réussi, badges validation |
| `--color-eisf-nav` | `#3465AE` | **Bleu marine EISF** | Navigation, icônes features, titres exports, texte Inès |
| `--color-eisf-warning` | `#E6A440` | **Orange EISF** | Avertissements, propositions IA (bandeau amber) |
| `--color-eisf-neutral` | `#E6E2E6` | **Gris neutre** | Background global de l'app, séparateurs, skeletons |
| `--color-eisf-white` | `#FFFFFF` | **Blanc** | Cards, headers, modals, surfaces élevées |
| `--color-eisf-text` | `#000000` | **Noir** | Texte principal (foreground) |

### 1.2 Couleurs sémantiques (design system)

| Token | Hex | Usage |
|---|---|---|
| `--color-background` | `#E6E2E6` | Fond de page global |
| `--color-foreground` | `#000000` | Texte principal |
| `--color-card` | `#FFFFFF` | Fond des cards |
| `--color-card-foreground` | `#000000` | Texte dans les cards |
| `--color-popover` | `#FFFFFF` | Fond des popovers/dropdowns |
| `--color-popover-foreground` | `#000000` | Texte des popovers |
| `--color-primary` | `#D6475B` | Boutons primaires, CTA |
| `--color-primary-foreground` | `#FFFFFF` | Texte sur primaire |
| `--color-secondary` | `#6BB8CD` | Info, badges secondaires |
| `--color-secondary-foreground` | `#FFFFFF` | Texte sur secondaire |
| `--color-muted` | `#F0EEF0` | Hover léger, fonds inactifs |
| `--color-muted-foreground` | `#6B6B6B` | Texte secondaire/grisé |
| `--color-accent` | `#BDD145` | Succès, score fidélité |
| `--color-accent-foreground` | `#000000` | Texte sur accent |
| `--color-destructive` | `#D6475B` | Suppression, erreurs (= primary) |
| `--color-destructive-foreground` | `#FFFFFF` | Texte sur destructive |
| `--color-border` | `#D4D0D4` | Bordures par défaut |
| `--color-input` | `#D4D0D4` | Bordures des inputs |
| `--color-ring` | `#D6475B` | Focus ring (rouge EISF) |

### 1.3 Couleurs additionnelles utilisées dans le code (hardcoded)

| Hex | Où | Usage |
|---|---|---|
| `#c03d50` | Boutons hover | Variante foncée du rouge EISF (hover CTA) |
| `#E0DCE0` | Headers, borders | Bordure subtile header, séparateurs secondaires |
| `#F8F7F8` | Cards features | Fond légèrement teinté pour cards secondaires |
| `#F5F4F5` | Landing mockup | Fond du mock app dans le hero |
| `#FFF0F2` | Dropdown logout | Hover rose très clair sur bouton déconnexion |
| `#F0EEF0` | Nav hover | Hover léger sur items de navigation |

---

## 2. Couleurs par personnage

### 2.1 Dans l'application (PodcastEditor)

Les personnages utilisent les couleurs EISF dans l'éditeur de podcast :
- **Inès** : textes et indicateurs en bleu marine `#3465AE`
- **Yannick** : textes et indicateurs en rouge `#E63337`

> [!IMPORTANT]
> Le rouge personnage Yannick (`#E63337`) est **différent** du rouge EISF UI (`#D6475B`). C'est une couleur spécifique aux exports et à l'identification des personnages.

### 2.2 Dans les exports Word (.docx)

Source : [export.js](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/EISF%20Studio/4%20Antigravity%20EISF%20Studio/server/routes/export.js)

| Élément | Couleur | Police |
|---|---|---|
| En-tête tableau (fond) | `#3465AE` (bleu marine) | Open Sans, 10pt, blanc |
| Texte en-tête | `#FFFFFF` | Open Sans, bold |
| Nom Inès | `#3465AE` (bleu marine) | Open Sans, bold |
| Nom Yannick | `#E63337` (rouge) | Open Sans, bold |
| Titre document | `#3465AE` | Open Sans, 16pt, bold |
| Sous-titre (nom podcast) | `#3465AE` | Open Sans, 14pt |
| Bordures tableau | `#CCCCCC` | — |
| Texte dialogues | Noir | Open Sans, 10pt |
| Section | Noir | Open Sans, 9pt, italique |

### 2.3 Dans les exports PDF

| Élément | Couleur | Police |
|---|---|---|
| Titre | Noir | Helvetica-Bold, 24pt |
| Sous-titre | `#3465AE` | Helvetica, 18pt |
| Nom Inès | `#3465AE` | Helvetica-Bold, 12pt |
| Nom Yannick | `#E63337` | Helvetica-Bold, 12pt |
| Durée/section | Gris | Helvetica-Oblique, 10pt |
| Texte dialogue | Noir | Helvetica, 12pt (studio) / 14pt (lecture) |

---

## 3. Typographie

### 3.1 Application web (frontend)

| Token | Valeur | Usage |
|---|---|---|
| `--font-sans` | `Verdana, Geneva, sans-serif` | Tout le texte de l'interface |
| `--font-display` | `Verdana, Geneva, sans-serif` | Titres (identique à sans) |

- **Police système** : Verdana — aucun import Google Fonts, aucune dépendance réseau
- **Antialiasing** : `antialiased` appliqué sur `body`
- **Font features** : `"rlig" 1, "calt" 1` (ligatures standard + alternatives contextuelles)

> [!NOTE]
> Historique : La V1.3 a remplacé Open Sans et Sora par Verdana (police système). Cela simplifie le chargement et assure la cohérence sur tous les OS.

### 3.2 Exports Word

- Police : **Open Sans** (restée inchangée dans les exports, différente du frontend)
- Tailles : 10pt corps, 16pt titre principal, 14pt sous-titre, 9pt section

### 3.3 Exports PDF

- Police : **Helvetica** (police PDFKit par défaut)
- Variantes : Helvetica-Bold, Helvetica-Oblique
- Tailles : 24pt titre, 18pt sous-titre, 12pt corps, 10pt métadonnées

---

## 4. Bordures & Radius

### 4.1 Border radius (style Notion/Linear)

| Token | Valeur | Usage typique |
|---|---|---|
| `--radius-sm` | `0.375rem` (6px) | Petits badges, tags |
| `--radius-md` | `0.5rem` (8px) | Inputs, petits boutons |
| `--radius` | `0.75rem` (12px) | Boutons standards, cards |
| `--radius-lg` | `0.75rem` (12px) | Cards moyennes |
| `--radius-xl` | `1rem` (16px) | Cards principales |
| `--radius-2xl` | `1.25rem` (20px) | Modals, grands containers |

### 4.2 Bordures utilisées dans le code

| Classe/couleur | Usage |
|---|---|
| `border-border` (`#D4D0D4`) | Bordure par défaut (appliquée globalement via `@layer base`) |
| `border-[#E0DCE0]` | Headers, séparateurs principaux |
| `border-[#E6E2E6]` | Séparateurs légers (landing, footer) |
| `border-dashed border-[#D4D0D4]` | Zone de drop fichier |
| `border-[#BDD145]` | Drop zone après upload réussi |
| `border-[#D6475B]` | Drop zone active (drag over) |
| `border-[#D6475B]/20` | Bordure erreur subtile |
| `border-white/50` | Bouton secondaire sur fond rouge (CTA banner) |

---

## 5. Ombres

| Token | Valeur | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Petites cartes |
| `--shadow-eisf` | `0 2px 12px 0 rgb(0 0 0 / 0.07)` | Cards standards |
| `--shadow-eisf-hover` | `0 6px 24px 0 rgb(0 0 0 / 0.12)` | Cards au hover |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | Modals, dropdowns |

### Ombres hardcoded dans le code

| Valeur | Composant |
|---|---|
| `shadow-[0_1px_4px_0_rgb(0,0,0,0.06)]` | Header sticky |
| `shadow-[0_2px_24px_0_rgb(0,0,0,0.09)]` | Card principale (Create page) |
| `shadow-[0_8px_40px_0_rgb(0,0,0,0.12)]` | Mockup app hero (Landing) |
| `shadow-[0_2px_16px_0_rgb(0,0,0,0.07)]` | Cards features hover (Landing) |
| `shadow-2xl` | Menu mobile (slide-over) |

---

## 6. Animations

### 6.1 Keyframes définis dans le design system

| Animation | Durée | Easing | Description |
|---|---|---|---|
| `fade-in` | 350ms | ease-out | Apparition avec translation Y +8px → 0 |
| `slide-in` | 250ms | ease-out | Apparition avec translation X -12px → 0 |
| `accordion-down` | 200ms | ease-out | Ouverture accordéon (height 0 → auto) |
| `accordion-up` | 200ms | ease-out | Fermeture accordéon (height auto → 0) |
| `spin-slow` | — | — | Rotation continue (360°) |

### 6.2 Animations Framer Motion (utilisées dans les composants)

| Composant | Type | Détails |
|---|---|---|
| **AppLayout** | fade + slide Y | `opacity: 0→1, y: 6→0` (250ms) |
| **Landing Hero (left)** | fade + slide X | `opacity: 0→1, x: -20→0` (500ms) |
| **Landing Hero (right)** | fade + slide X | `opacity: 0→1, x: 20→0` (500ms, delay 150ms) |
| **Landing Features** | fade + slide Y | `opacity: 0→1, y: 12→0` (delay 100ms + 70ms/item) |
| **Create card** | fade + slide Y | `opacity: 0→1, y: 14→0` (300ms) |
| **Mobile menu backdrop** | fade | `opacity: 0→1` |
| **Mobile menu panel** | slide X | `x: 100%→0` (spring: damping 25, stiffness 200) |

### 6.3 Transitions CSS

| Type | Durée | Usage |
|---|---|---|
| `transition-colors` | 150ms (default) | Tous les boutons, liens, hover states |
| `transition-all` | 150ms | Inputs (focus), boutons disabled |
| `transition-shadow` | 150ms | Cards features (hover shadow) |
| `active:scale-[0.99]` | — | Boutons CTA (micro-feedback au clic) |
| `filter 300ms` | 300ms | Logo hover (drop-shadow) |

---

## 7. Layout & Spacing

### 7.1 Dimensions globales

| Élément | Valeur |
|---|---|
| Max-width app | `1400px` (AppLayout) |
| Max-width landing | `1280px` (max-w-6xl) |
| Padding horizontal | `24px` (px-6) |
| Header height | `56px` (h-14) |
| Content padding top | `32px` (py-8) |

### 7.2 Cards

| Propriété | Valeur |
|---|---|
| Fond | `#FFFFFF` |
| Border radius | `rounded-2xl` (16px) |
| Border | `1px solid #E0DCE0` |
| Shadow | Voir section ombres |
| Padding intérieur | `32px` (p-8) typique |

---

## 8. Icônes

- **Bibliothèque** : Lucide React (`lucide-react` v0.5x)
- **Taille standard** : `h-4 w-4` (16px) pour les actions inline
- **Taille features** : `h-5 w-5` (20px) dans les blocs features
- **Taille drop zone** : `h-10 w-10` (40px)
- **Logo badge** : `h-7 w-7` (28px) container, `h-4 w-4` icône

---

## 9. Divergences cahier des charges vs implémentation

> [!WARNING]
> Le cahier des charges (v1.3, avril 2026) liste une palette **différente** de celle implémentée.

| Élément | Cahier des charges | Implémentation réelle |
|---|---|---|
| Couleur primaire | `#3465AE` (bleu) | `#D6475B` (rouge) — le bleu est devenu `eisf-nav` |
| Couleur secondaire | `#E63337` (rouge) | `#6BB8CD` (cyan) — le rouge `E63337` est réservé au personnage Yannick |
| Couleur accent | `#FEECD7` (beige) | `#BDD145` (vert anis) |
| Typographie | Système (Tailwind default) | Verdana, Geneva, sans-serif |
| Thème | Light / Dark via Tailwind | Light uniquement (pas de dark mode) |

> [!IMPORTANT]
> **Le cahier des charges n'est plus à jour.** La charte réelle est celle définie dans [index.css](file:///c:/Users/marti/Ecole%20Internationale%20du%20Savoir%20Faire%20Français/ADMINISTRATION%20-%20IA-EISF/3-EISF%20Studio/EISF%20Studio/4%20Antigravity%20EISF%20Studio/client/src/index.css) (section `@theme`, lignes 3-101).

---

## 10. Exports — police Open Sans vs Verdana

> [!WARNING]
> **Incohérence** : Le frontend utilise Verdana (depuis V1.3), mais les exports Word utilisent encore **Open Sans**. Si la charte doit être unifiée, il faudrait aligner `export.js` sur Verdana.

| Contexte | Police |
|---|---|
| Interface web | Verdana |
| Exports Word (.docx) | Open Sans |
| Exports PDF | Helvetica (imposée par PDFKit) |

---

## 11. Résumé visuel rapide

```
┌─────────────────────────────────────────┐
│  PALETTE EISF                           │
│                                         │
│  🔴 #D6475B  Rouge      → Primary/CTA  │
│  🔵 #3465AE  Bleu       → Nav/Export    │
│  🩵 #6BB8CD  Cyan       → Secondary    │
│  🟢 #BDD145  Vert anis  → Accent/OK    │
│  🟠 #E6A440  Orange     → Warning      │
│  ⚪ #E6E2E6  Gris       → Background   │
│  ⬜ #FFFFFF  Blanc      → Cards        │
│  ⬛ #000000  Noir       → Texte        │
│                                         │
│  PERSONNAGES                            │
│  Inès    → #3465AE (bleu marine)        │
│  Yannick → #E63337 (rouge vif)          │
│                                         │
│  TYPO: Verdana (web) / Open Sans (Word) │
│  THÈME: Light uniquement                │
│  STYLE: Notion/Linear (flat, minimal)   │
└─────────────────────────────────────────┘
```
