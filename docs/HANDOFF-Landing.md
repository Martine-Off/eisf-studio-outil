# Hand-off Claude Code — LANDING (refonte esthétique + contenu)

> Cible : `Landing.tsx` (+ `AppLayout.tsx` footer + `client/index.html` meta). Maquette de référence : `eisf-landing.html`.
> **Règle d'or** : refonte **présentation + contenu** uniquement. Conserve `react-router-dom` (`Link`), `framer-motion` (`motion`), `export default`, le routing et tout state éventuel. On ne change que JSX de présentation, classes Tailwind et textes.

> ⚠️ La landing est la **seule page marketing** : on assume une touche de marque (liseré tricolore + couleurs charte vives). Dans l'app, on reste sur le système anthracite (voir `HANDOFF-DesignSystem.md`).

## Palette (charte EISF) — valeurs arbitraires Tailwind
| Rôle | Hex | Classe |
|---|---|---|
| Bleu marque / CTA | `#3465AE` | `bg-[#3465AE]` `text-[#3465AE]` |
| Bleu vif (hover CTA) | `#007BC1` | `hover:bg-[#007BC1]` |
| Rouge (liseré only) | `#E63337` | `bg-[#E63337]` |
| Cyan (Inès / accent) | `#6BB8CD` | `text-[#6BB8CD]` `border-[#6BB8CD]` |
| Mauve (IA / Yannick) | `#A973AF` | `text-[#A973AF]` |
| Anis (succès / fidélité) | `#BDD145` | `bg-[#BDD145]` |
| Jaune | `#FECD32` | — |
| Orange (étape 4) | `#EF804E` | `text-[#EF804E]` |
| Texte | `#1C1B22` | `text-[#1C1B22]` |
| Texte doux | `#5A5963` | `text-[#5A5963]` |
| Bordures | `#E8E6EA` | `border-[#E8E6EA]` |
| Fond doux (sections) | `#F5F4F7` | `bg-[#F5F4F7]` |
| Titres | font Sansation (fallback Jost) | classe `font-heading` ou util |

## Logo
- Déposer le fichier fourni en `public/logo-eisf.png`.
- Remplacer le bloc `bg-[#D6475B]` + `<GraduationCap>` par : `<img src="/logo-eisf.png" alt="EISF" className="h-9 w-auto" />` + `<span>Studio <span className="text-[#3465AE]">EISF</span></span>` en `font-heading font-bold`.
- **Liseré tricolore** tout en haut (remplace `h-1 bg-[#D6475B]`) : 3 bandes égales bleu / blanc / rouge, `h-1`.

## Section par section

### 1. Navbar
- `sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#E8E6EA]`.
- Logo à gauche (voir ci-dessus).
- À droite : **uniquement** « Se connecter » → `<Link to="/login">`, `px-5 py-2 rounded-lg bg-[#3465AE] text-white font-bold hover:bg-[#007BC1]`.
- **Supprimer** le bouton/lien « Créer un compte » / « S'inscrire ».

### 2. Hero
- Fond clair (blanc, halos `bg-[#6BB8CD]/10` et `bg-[#FECD32]/10` en `blur-3xl`, optionnels).
- **Badges** (au-dessus du titre) :
  - `Contenu certifié EISF` : `bg-[#3465AE]/10 text-[#3465AE] border border-[#3465AE]/20`, icône check.
  - `Généré par IA` : `bg-[#A973AF]/12 text-[#A973AF] border border-[#A973AF]/25`, icône sparkles.
- **H1** (`font-heading font-bold`, ~2.7rem) : « Transformez vos cours en **podcasts pédagogiques** » — « podcasts pédagogiques » en `text-[#3465AE]`.
- **Sous-titre** (`text-[#5A5963]`, max-w-xl) : « Studio EISF génère automatiquement des dialogues audio à partir de vos exports Storyline (.docx). Fidélité au contenu source garantie, prêt à écouter en quelques clics. »
- **CTA** : `Se connecter` → `<Link to="/login">`, `bg-[#3465AE] hover:bg-[#007BC1] text-white rounded-lg px-6 py-3.5 font-bold`, flèche →. À côté, 2 puces `bg-[#BDD145]` : « Sans installation » · « Export .mp3 ».
- **Mockup app** (colonne droite, `lg:grid-cols-[1.05fr_.95fr]`) : carte `rounded-2xl border border-[#E8E6EA] shadow-2xl` — barre mac (3 dots) + titre « Studio EISF · La crème pâtissière » ; 2 répliques avec filet gauche : **Inès** `border-l-[3px] border-[#6BB8CD]`, nom `text-[#6BB8CD]` ; **Yannick** `border-l-[3px] border-[#A973AF]` (décalé `ml-6`), nom `text-[#A973AF]` ; mini-player (rond play `bg-[#3465AE]`, waveform, « 1:24 / 8:42 ») ; pastille flottante `bg-[#BDD145] text-[#1C1B22]` « Fidélité 97% ».

### 3. Section « Comment ça marche » (NOUVELLE, entre hero et features)
- Conteneur `bg-[#F5F4F7] border-y border-[#E8E6EA]`, titre centré `font-heading` + sur-titre « Le parcours » `text-[#3465AE]`.
- **4 étapes** en grille `md:grid-cols-4`, cartes `bg-white rounded-xl border border-[#E8E6EA] p-6`, numéro fantôme `01..04` en haut à droite + icône pastille + titre + texte :
  1. **Import** — « Glissez votre export .docx Articulate Storyline. » (bleu, icône download)
  2. **Génération IA** — « L'IA crée un dialogue naturel entre deux personnages — expert et apprenant. » (mauve, icône sparkles)
  3. **Édition & Vérification** — « Relisez, éditez, vérifiez la fidélité au contenu source. » (cyan, icône crayon)
  4. **Export Audio** — « Générez le MP3 final et exportez pour vos apprenants. » (orange, icône volume)

### 4. FeatureCards (remplace les 6 features actuelles par 3)
Grille `md:grid-cols-3 gap-6`, cartes `rounded-2xl border border-[#E8E6EA] p-7 hover:shadow-xl`, icône pastille + titre `font-heading` + texte :
- **Import Storyline** — « Glissez votre export .docx Articulate Storyline pour démarrer instantanément. » (icône fichier, bleu)
- **Dialogue IA** — « L'IA génère un dialogue naturel entre deux personnages IA, fidèle à votre contenu source. » (icône dialogue, mauve)
- **Audio & Export** — « Écoutez, éditez, vérifiez la fidélité et exportez le podcast final pour vos apprenants. » (icône musique, anis)

> Supprime l'ancien tableau `features` à 6 entrées (Cursus Professionnel, Objectifs Précis, etc.) et l'éventuel bandeau CTA rouge plein.

### 5. Footer (Landing ET AppLayout)
- Une seule ligne, pas de colonnes : logo + « Studio EISF » à gauche, à droite :
  **« © 2026 EISF — École Internationale du Savoir-Faire Français. Développé par Martine Desmaroux. »** `text-[#5A5963]`.
- **Supprimer** toutes les sections **Produit / Support / Suivez-nous** et les icônes sociales (Twitter/Linkedin/Youtube/Facebook) — retire aussi les imports lucide devenus inutiles.

### 6. `client/index.html` — meta copyright (dans `<head>`)
```html
<meta name="author" content="Martine Desmaroux — EISF" />
<meta name="copyright" content="© 2026 EISF — Tous droits réservés" />
```

## À préserver
- Imports `Link` (react-router) et `motion` (framer-motion), `export default function Landing()`, toute animation d'entrée existante. Si tu supprimes des icônes lucide, retire-les **aussi** de l'`import { … }` pour éviter les warnings.

## Prompt à coller
> Applique `HANDOFF-Landing.md` à `Landing.tsx` (+ footer de `AppLayout.tsx` + meta de `client/index.html`), en reproduisant la maquette `eisf-landing.html`. Couleurs charte EISF (valeurs arbitraires), logo `public/logo-eisf.png` à la place du `GraduationCap`, navbar avec seul « Se connecter » → /login, hero (badges + titre/sous-titre exacts + CTA + mockup player), nouvelle section « Comment ça marche » à 4 étapes, 3 FeatureCards, footer réduit à la ligne copyright (supprime Produit/Support/Suivez-nous + icônes sociales + imports inutiles). **Ne touche pas** au routing, à `framer-motion`, ni à aucune autre page. Montre-moi le diff de `Landing.tsx`, `AppLayout.tsx`, `client/index.html`.
