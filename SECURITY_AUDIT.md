# SECURITY_AUDIT.md — EISF Studio

> Audit réalisé le 2026-05-26 — Mis à jour le 2026-05-28  
> Portée : backend Node.js/Express, frontend React/TypeScript, base PostgreSQL  
> Auditeur : Claude Sonnet 4.6 (Anthropic) — commandé par Martine Desmaroux  

---

## Résumé exécutif

L'application EISF Studio présentait **2 vulnérabilités CRITIQUES**, **6 ÉLEVÉES** et **5 MOYENNES**.  
**10 vulnérabilités sur 13 ont été corrigées** (2026-05-28). Restent ouvertes : V1, V2, V5 (architecturalement plus lourdes — nécessitent des changements frontend + backend).

---

## Tableau de synthèse

| ID  | Vulnérabilité                          | Catégorie       | Criticité | Statut | Fichier(s) principal(aux)      |
|-----|----------------------------------------|-----------------|-----------|--------|-------------------------------|
| V1  | JWT stocké en localStorage             | Auth / XSS      | CRITIQUE  | 🔴 Ouvert | `client/src/context/AuthContext.tsx`, `client/src/utils/api.ts` |
| V2  | Absence de protection CSRF             | CSRF            | ÉLEVÉE    | 🔴 Ouvert | `server/server.js`            |
| V3  | Uploads publics sans authentification  | Upload / Accès  | ÉLEVÉE    | ✅ Corrigé | `server/routes/projects.js`, `server/server.js` |
| V4  | Injection indirecte (entrées non validées) | Injection    | ÉLEVÉE    | ✅ Corrigé | `server/routes/ai.js`         |
| V5  | Tokens JWT non révocables              | Auth            | ÉLEVÉE    | 🔴 Ouvert | `server/routes/auth.js`       |
| V6  | URL du webhook Make dans les logs      | Secrets         | ÉLEVÉE    | ✅ Corrigé | `server/utils/callWebhook.js` |
| V7  | Absence de garde d'autorisation (reorder dialogues) | AuthZ | ÉLEVÉE | ✅ Corrigé | `server/routes/dialogues.js`  |
| V8  | Routes d'export sans authentification | Auth             | CRITIQUE  | ✅ Corrigé | `server/routes/podcasts.js`   |
| V9  | URL webhook dans les messages d'erreur | Secrets         | MOYENNE   | ✅ Corrigé | `server/routes/podcasts.js`, `server/routes/ai.js` |
| V10 | Politique de mot de passe insuffisante | Auth            | MOYENNE   | ✅ Corrigé | `server/routes/auth.js`       |
| V11 | Rate limiting incomplet                | DoS             | MOYENNE   | ✅ Corrigé | `server/server.js`            |
| V12 | Absence de redirection HTTPS           | Transport       | MOYENNE   | ✅ Corrigé | `server/server.js`            |
| V13 | Contenu dialogue non validé (TTS)      | Validation      | MOYENNE   | ✅ Corrigé | `server/utils/callGeminiTTS.js` |

---

## Détail des vulnérabilités

---

### V1 — JWT stocké en localStorage (XSS Vector)

**Criticité : CRITIQUE**  
**Fichiers :**
- `client/src/context/AuthContext.tsx` lignes 35-47, 54-55
- `client/src/utils/api.ts` lignes 14, 28-29

**Description :**  
Les tokens JWT sont stockés en `localStorage` sans protection HttpOnly. Toute injection XSS (dans un contenu utilisateur rendu sans échappement, ou via une extension malveillante) permet de voler le token via `localStorage.getItem('token')` et d'usurper l'identité de l'utilisateur pour la durée de validité du token (7 jours).

**Recommandation :**
```javascript
// Backend — après login, définir un cookie HttpOnly
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
});

// Supprimer tout usage de localStorage pour le JWT
// Le cookie est envoyé automatiquement par le navigateur
```

Ajouter également un en-tête `Content-Security-Policy` restrictif pour réduire la surface XSS.

---

### V2 — Absence de protection CSRF

**Criticité : ÉLEVÉE**  
**Fichier :** `server/server.js` lignes 23-41

**Description :**  
Aucun token CSRF n'est généré ni vérifié. Un attaquant peut forger des requêtes cross-site qui créent/suppriment des projets, déclenchent des générations IA, ou effacent des données — tant que le navigateur envoie automatiquement le cookie ou le JWT stocké.

**Recommandation :**
```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
const csrfProtection = csrf({ cookie: false });
app.use('/api/projects', csrfProtection);
app.use('/api/podcasts', csrfProtection);
app.use('/api/dialogues', csrfProtection);
// Le token CSRF est attendu dans l'en-tête X-CSRF-Token de chaque requête mutante
```

---

### V3 — Fichiers uploadés accessibles sans authentification

**Criticité : ÉLEVÉE**  
**Fichiers :**
- `server/routes/projects.js` lignes 23-53, 74-122
- `server/server.js` ligne 65

**Description :**  
Le répertoire `uploads/` est servi publiquement sans authentification (`app.use('/uploads', express.static(...))`). Les noms de fichiers sont générés avec `Date.now()`, ce qui est prévisible. N'importe qui connaissant ou devinant l'URL peut télécharger un fichier `.docx` source appartenant à un autre utilisateur.

**Recommandation :**
```javascript
// Protéger le répertoire uploads
app.use('/uploads', authMiddleware, express.static(path.join(__dirname, 'uploads')));

// Générer un nom de fichier aléatoire
const crypto = require('crypto');
const uploadId = crypto.randomBytes(16).toString('hex');
const filename = `${uploadId}.docx`;

// Suivre les uploads en base (user_id, stored_path) pour vérification de propriété
```

---

### V4 — Injection indirecte via entrées non validées

**Criticité : ÉLEVÉE**  
**Fichier :** `server/routes/ai.js` lignes 66, 81-84, 360

**Description :**  
Les titres de projets, noms de personnages et contenu du cours source (`cleaned_text`) sont utilisés directement dans les prompts envoyés au webhook Make, sans validation préalable. Un contenu malveillant peut manipuler le comportement du LLM (prompt injection), injecter du contenu dans les logs, ou provoquer des erreurs imprévues.

**Recommandation :**
```javascript
const { body, validationResult } = require('express-validator');

router.post('/create', authMiddleware,
  body('title').trim().isLength({ min: 1, max: 255 }).escape(),
  body('content').trim().isLength({ max: 200000 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors });
    next();
  },
  handler
);

// Noms de personnages
const name1 = (req.body.character_1_name || '').trim().substring(0, 50).replace(/[^\w\sÀ-ÿ-]/g, '');
```

---

### V5 — Tokens JWT non révocables

**Criticité : ÉLEVÉE**  
**Fichier :** `server/routes/auth.js` lignes 43-47, 88-92

**Description :**  
Les tokens JWT ont une durée de vie de 7 jours et ne peuvent pas être invalidés. Si un compte est compromis ou un token volé, l'attaquant dispose d'un accès complet pendant 7 jours. Il n'existe pas de route `/logout` effective ni de liste noire de tokens.

**Recommandation :**
```javascript
// Implémenter un access token court (15 min) + refresh token (7 jours)
const accessToken = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '15m' });
const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

// Liste noire en base ou Redis pour logout / révocation d'urgence
// Table : token_blacklist (jti TEXT, expires_at TIMESTAMPTZ)
// authMiddleware vérifie la liste noire avant d'accepter un token
```

---

### V6 — URL du webhook Make journalisée en clair

**Criticité : ÉLEVÉE**  
**Fichier :** `server/utils/callWebhook.js` lignes 17-18

**Description :**  
L'URL complète du webhook Make est loggée à chaque appel :  
```javascript
console.log(`[callWebhook] → ${url}`);
```  
Si les logs sont agrégés dans un outil externe (CloudWatch, Sentry, Datadog), l'URL du webhook est exposée et peut être utilisée par un tiers pour déclencher des appels arbitraires.

**Recommandation :**
```javascript
// Ne jamais logger l'URL complète
console.log(`[callWebhook] type=${payload.type} payload=${JSON.stringify(payload).length}o`);

// En cas d'erreur, masquer les secrets
console.error(`[callWebhook] Erreur type=${payload.type} status=${response?.status ?? 'N/A'}`);
```

---

### V7 — Absence de vérification de propriété sur le réordonnancement des dialogues

**Criticité : ÉLEVÉE**  
**Fichier :** `server/routes/dialogues.js` lignes 12-42

**Description :**  
La route `PATCH /reorder` accepte n'importe quelle liste d'IDs de dialogues sans vérifier qu'ils appartiennent à l'utilisateur authentifié. Un attaquant peut réordonner ou corrompre les dialogues d'autres utilisateurs via énumération d'IDs.

**Recommandation :**
```javascript
router.patch('/reorder', authMiddleware, async (req, res) => {
  const { dialogues } = req.body;

  // Vérifier que tous les dialogues appartiennent à l'utilisateur
  const owned = await pool.query(
    `SELECT d.id FROM dialogues d
     JOIN podcasts p ON d.podcast_id = p.id
     JOIN projects pr ON p.project_id = pr.id
     WHERE pr.user_id = $1 AND d.id = ANY($2::int[])`,
    [req.userId, dialogues.map(d => d.id)]
  );

  if (owned.rows.length !== dialogues.length) {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  // ... mise à jour
});
```

---

### V8 — Routes d'export sans authentification

**Criticité : CRITIQUE**  
**Fichier :** `server/routes/podcasts.js` lignes 476-602

**Description :**  
Les routes `GET /:id/export-word/:mode` et `GET /:id/export-txt` n'utilisent pas `authMiddleware`. N'importe qui connaissant l'ID d'un podcast peut en exporter le contenu complet, sans être authentifié ni propriétaire du podcast.

**Recommandation :**
```javascript
// Ajouter authMiddleware et vérification de propriété sur chaque route d'export
router.get('/:id/export-word/:mode', authMiddleware, async (req, res) => {
  await assertPodcastOwner(req.params.id, req.userId);
  // ... logique d'export existante
});

router.get('/:id/export-txt', authMiddleware, async (req, res) => {
  await assertPodcastOwner(req.params.id, req.userId);
  // ...
});
```

---

### V9 — URL webhook dans les messages d'erreur

**Criticité : MOYENNE**  
**Fichiers :**
- `server/routes/podcasts.js` lignes 120, 467
- `server/routes/ai.js` lignes 630, 805

**Description :**  
Les messages d'erreur retournés au client peuvent inclure le message brut de l'exception, qui peut lui-même contenir l'URL Make si le service répond avec une erreur contenant des détails de redirection ou de configuration.

**Recommandation :**
```javascript
const isProduction = process.env.NODE_ENV === 'production';
res.status(500).json({
  error: isProduction ? 'Erreur interne. Réessayez.' : error.message.substring(0, 100)
});
```

---

### V10 — Politique de mot de passe insuffisante

**Criticité : MOYENNE**  
**Fichier :** `server/routes/auth.js` lignes 13-54

**Description :**  
L'inscription accepte tout mot de passe, y compris `"1"`, sans vérification de longueur minimale ni de complexité. Rend les comptes vulnérables à la force brute et aux dictionnaires.

**Recommandation :**
```javascript
const { body } = require('express-validator');

router.post('/register', [
  body('password')
    .isLength({ min: 12 }).withMessage('Minimum 12 caractères')
    .matches(/[A-Z]/).withMessage('Doit contenir une majuscule')
    .matches(/[a-z]/).withMessage('Doit contenir une minuscule')
    .matches(/[0-9]/).withMessage('Doit contenir un chiffre')
], handler);
```

---

### V11 — Rate limiting incomplet

**Criticité : MOYENNE**  
**Fichier :** `server/server.js` lignes 53-56

**Description :**  
Le rate limiting est configuré uniquement par adresse IP, ce qui est inopérant derrière un proxy. Les routes d'export, de génération audio et d'upload ne sont pas couvertes par des limiteurs spécifiques au coût de l'opération.

**Recommandation :**
```javascript
// Utiliser req.userId comme clé quand disponible
const perUserLimiter = rateLimit({
  keyGenerator: (req) => req.userId || req.ip,
  windowMs: 60 * 1000,
  max: 20
});

// Limiter les exports et uploads séparément
router.get('/:id/export-word/:mode', authMiddleware, exportLimiter, handler);
router.post('/import', authMiddleware, uploadLimiter, handler);

// Si derrière un proxy, activer app.set('trust proxy', 1)
```

---

### V12 — Absence de redirection HTTPS et d'en-tête HSTS

**Criticité : MOYENNE**  
**Fichier :** `server/server.js`

**Description :**  
En production, le serveur n'impose pas HTTPS. Les tokens JWT et les credentials transmis en HTTP peuvent être interceptés (MITM). Aucun en-tête `Strict-Transport-Security` n'est défini.

**Recommandation :**
```javascript
// Redirection HTTP → HTTPS
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
});

// HSTS
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Pool PostgreSQL avec SSL en production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
});
```

---

### V13 — Contenu dialogue non validé avant envoi TTS

**Criticité : MOYENNE**  
**Fichier :** `server/utils/callGeminiTTS.js` lignes 49-61

**Description :**  
Le texte des dialogues est envoyé à l'API Gemini TTS sans validation préalable : caractères de contrôle, encodage invalide, ou longueur excessive peuvent provoquer des erreurs non gérées ou un comportement inattendu du modèle.

**Recommandation :**
```javascript
function validateDialogueText(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ' ');
  if (cleaned.length > 2000) cleaned = cleaned.substring(0, 2000);
  cleaned = cleaned.replace(/\[PROPOSITION:[^\]]*\]/g, '');
  return cleaned.trim();
}

const script = dialogues
  .map(d => `${speaker}: ${validateDialogueText(d.text_studio)}`)
  .join('\n');
```

---

## Plan de remédiation prioritaire

### Immédiat (< 48 h)
- **V8** : Ajouter `authMiddleware` + `assertPodcastOwner` aux routes d'export
- **V6** : Supprimer l'URL webhook des logs
- **V7** : Ajouter la vérification de propriété sur `/reorder`

### Court terme (1-2 semaines)
- **V1** : Migrer de localStorage vers des cookies HttpOnly
- **V2** : Implémenter les tokens CSRF
- **V5** : Ajouter route de rafraîchissement token et mécanisme de révocation
- **V10** : Validation de complexité du mot de passe à l'inscription

### Moyen terme (2-4 semaines)
- **V3** : Authentifier les téléchargements depuis `uploads/`
- **V4** : Middleware de validation `express-validator` sur toutes les routes mutantes
- **V11** : Rate limiting par utilisateur, clés séparées pour exports et générations IA
- **V12** : Redirection HTTPS + HSTS + SSL PostgreSQL en production
- **V13** : Validation du texte dialogue avant appel TTS

---

*Document généré automatiquement — à vérifier par l'ingénieur responsable avant toute action corrective.*
