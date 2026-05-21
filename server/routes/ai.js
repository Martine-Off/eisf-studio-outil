const express = require('express');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const mammoth = require('mammoth');
const { callWebhook } = require('../utils/callWebhook');
const { extractSourceSection } = require('../utils/extractSourceSection');
const { groundingCheck } = require('../utils/groundingCheck');

const INTRO_TEXT = "<break time=\"2s\" /> Bonjour et bienvenue dans ce podcast de formation EISF — votre capsule audio pour comprendre, apprendre et progresser à votre rythme. Cet épisode, généré par intelligence artificielle à partir de contenus rédigés et validés par nos formateurs, vous accompagne dans vos apprentissages théoriques.";
const OUTRO_TEXT = "Ce podcast est une création EISF. Il a été généré par intelligence artificielle à partir de contenus pédagogiques rédigés et validés par nos formateurs. Toute reproduction ou diffusion est interdite sans autorisation. <break time=\"2s\" />";

const INTRO_READING = "Bonjour et bienvenue dans ce podcast de formation E.I.S.F. — votre capsule audio pour comprendre, apprendre et progresser à votre rythme. Cet épisode, généré par intelligence artificielle à partir de contenus rédigés et validés par nos formateurs, vous accompagne dans vos apprentissages théoriques.";
const OUTRO_READING = "Ce podcast est une création E.I.S.F.. Il a été généré par intelligence artificielle à partir de contenus pédagogiques rédigés et validés par nos formateurs. Toute reproduction ou diffusion est interdite sans autorisation.";

const router = express.Router();

// ─── Helper : parser JSON robuste ────────────────────────────────────────────
function parseJSON(text) {
    try {
        return JSON.parse(text);
    } catch {
        // Tentative de récupération si le JSON est tronqué
        const cleaned = text.replace(/,\s*$/, '').trim();
        try { return JSON.parse(cleaned + '"}]}'); } catch { /* ignore */ }
        throw new Error('Impossible de parser le JSON GPT : ' + text.substring(0, 200));
    }
}

// ─── Helper : normaliser les <break time="..."> générés en français ───────────
function sanitizeBreakTimes(text) {
    if (!text) return text;
    return text.replace(/<break\s+time="([^"]+)"\s*\/>/gi, (_match, timeValue) => {
        const v = timeValue.trim().toLowerCase();
        if (/^\d+(\.\d+)?s$/.test(v)) return _match; // déjà valide (ex: "1s", "0.5s")
        if (/zéro.*(virgule|point).*cinq/i.test(v)) return '<break time="0.5s" />';
        if (/^zéro/i.test(v) || /^zero/i.test(v)) return '';         // 0s → supprimer
        if (/^une?\s*(seconde)?/i.test(v)) return '<break time="1s" />';
        if (/^deux\s*(secondes?)?/i.test(v)) return '<break time="2s" />';
        if (/^trois\s*(secondes?)?/i.test(v)) return '<break time="3s" />';
        return _match; // inconnu : laisser tel quel
    });
}

// ─── Helper : est-ce qu'on utilise le mock ? ─────────────────────────────────
function useMock() {
    return process.env.USE_MOCK_AI === 'true';
}

// ─────────────────────────────────────────────────────────────────────────────


function toTextString(result) {
  if (typeof result === 'string') return result;
  return result?.text || result?.output || JSON.stringify(result);
}

async function verifyScriptAgainstSource(segmentContent, scriptText, cachedConcepts = null) {
  let concepts = cachedConcepts && cachedConcepts.length > 0 ? cachedConcepts : null;

  // ─── Appel 1 : extraction des concepts (sauté si cache présent) ──────────
  if (!concepts) {
    const conceptsRaw = await callWebhook({
      type: 'verify-extract-concepts',
      prompt: `Tu es un extracteur de concepts pédagogiques.\nListe UNIQUEMENT les concepts, faits, chiffres présents dans ce texte.\nFormat : une ligne par concept, commençant par "- ". Sois atomique et exhaustif.\n\nExtrais TOUS les concepts de ce contenu source :\n\n${segmentContent}`
    });
    if (!conceptsRaw) throw new Error('Extraction des concepts impossible (Make n\'a pas répondu)');
    const conceptsText = toTextString(conceptsRaw);
    concepts = conceptsText
      .split('\n')
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim())
      .filter(Boolean);
    if (concepts.length === 0) throw new Error('Aucun concept extrait du source');
  }

  // ─── Appel 2 : vérification binaire présent/absent dans le script ─────────
  const verificationRaw = await callWebhook({
    type: 'verify-check-concepts',
    prompt: `Pour chaque concept, réponds UNIQUEMENT "present" ou "absent" selon qu'il est couvert (même reformulé) dans le script.\nFormat strict par ligne : concept | present   ou   concept | absent\n\nCONCEPTS:\n${concepts.map(c => `- ${c}`).join('\n')}\n\nSCRIPT:\n${scriptText}`
  });
  if (!verificationRaw) throw new Error('Vérification des concepts impossible (Make n\'a pas répondu)');
  const verificationText = toTextString(verificationRaw);

  // ─── Score calculé mathématiquement par l'app (présents / total × 100) ────
  const lines = verificationText.split('\n').filter(l => l.includes('|'));
  const total = lines.length;
  const validated = lines.filter(l => l.toLowerCase().includes('present')).length;
  const missing = lines.filter(l => !l.toLowerCase().includes('present'));
  const fidelityScore = total > 0 ? Math.round((validated / total) * 100) : 0;

  const allResults = lines.map(l => {
    const parts = l.split('|');
    return { concept: parts[0].trim(), status: l.toLowerCase().includes('present') ? 'present' : 'absent' };
  });

  return {
    fidelityScore,
    totalConcepts: total,
    validatedConcepts: validated,
    missingConcepts: missing.map(l => l.split('|')[0].trim()),
    extractedConcepts: concepts,
    allResults
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NETTOYAGE AUTOMATIQUE DU .DOCX AVANT DÉCOUPAGE
// ─────────────────────────────────────────────────────────────────────────────
async function cleanStorylineText(rawText) {
    let lines = rawText.split('\n').map(l => l.trim());
    
    // - Artefacts numériques collés : ligne.replace(/^\d+([A-ZÀ-Üa-zà-ü])/, '$1')
    lines = lines.map(line => line.replace(/^\d+([A-ZÀ-Üa-zà-ü])/g, '$1'));

    lines = lines.filter(line => {
        // - Lignes < 15 caractères
        if (line.length < 15) return false;
        // - Lignes de navigation
        if (/^(commencer|suivant|précédent|retour|continuer|fermer|replay)/i.test(line)) return false;
        // - Métadonnées Storyline / PowerPoint
        if (/^(zone de texte|état normal|état survol|id\s*:|slide\s*\d+|scène\s*\d+)/i.test(line)) return false;
        if (/^(nom de la (scène|diapositive|mise en page)|masques? de diapositives?|mises? en page)/i.test(line)) return false;
        if (/version de l.export/i.test(line)) return false;
        if (/^(v\d+\.\d+\.\d+|SingleTable|multi.?table)/i.test(line)) return false;
        if (/\bv\d+\.\d+\.\d+\.\d+-[A-Za-z]+\b/.test(line)) return false; // ex: v3.104.35448.0-SingleTable
        // - IDs alphanumériques purs
        if (/^[a-zA-Z0-9_\-]{8,40}$/.test(line)) return false;
        // - Lignes contenant uniquement chiffres ou ponctuation
        if (/^[\d\W]+$/.test(line)) return false;
        return true;
    });

    // - Lignes répétées (dédoublonnage après toLowerCase().trim())
    const uniqueLines = [];
    const seen = new Set();
    for (const line of lines) {
        const lower = line.toLowerCase();
        if (!seen.has(lower)) {
            seen.add(lower);
            uniqueLines.push(line);
        }
    }
    
    return uniqueLines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLIT PAR TITRES MARKDOWN (gratuit, 0 appel IA)
// ─────────────────────────────────────────────────────────────────────────────
function splitByHeadings(markdown) {
    const lines = markdown.split('\n');
    const segments = [];
    let currentTitle = null;
    let currentLines = [];

    for (const line of lines) {
        const m = line.match(/^(#{1,3})\s+(.+)/);
        if (m) {
            if (currentTitle !== null) {
                const content = currentLines.join('\n').trim();
                if (content) {
                    const wordCount = content.split(/\s+/).filter(w => w).length;
                    segments.push({ title: currentTitle, content, wordCount, estimatedMinutes: Math.round((wordCount * 1.2) / 130), thematic_note: `Chapitre : ${currentTitle}` });
                }
            }
            currentTitle = m[2].trim();
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }
    if (currentTitle !== null) {
        const content = currentLines.join('\n').trim();
        if (content) {
            const wordCount = content.split(/\s+/).filter(w => w).length;
            segments.push({ title: currentTitle, content, wordCount, estimatedMinutes: Math.round((wordCount * 1.2) / 130), thematic_note: `Chapitre : ${currentTitle}` });
        }
    }
    return segments;
}

// ─────────────────────────────────────────────────────────────────────────────
// RÉÉQUILIBRAGE DES SEGMENTS (fusion si trop courts, split si trop longs)
// ─────────────────────────────────────────────────────────────────────────────
function findSentenceBoundary(text, nearChar) {
    const range = 400;
    const start = Math.max(0, nearChar - range);
    const end = Math.min(text.length, nearChar + range);
    const excerpt = text.substring(start, end);
    const re = /[.!?]\s+/g;
    let best = null;
    let m;
    while ((m = re.exec(excerpt)) !== null) {
        const pos = start + m.index + m[0].length;
        if (best === null || Math.abs(pos - nearChar) < Math.abs(best - nearChar)) best = pos;
    }
    return best !== null ? best : nearChar;
}

function rebalanceSegments(segments, minWords = 875, maxWords = 780) {
    // Fusion des segments trop courts (vers le suivant)
    const merged = [];
    let i = 0;
    while (i < segments.length) {
        const seg = { ...segments[i] };
        while (seg.wordCount < minWords && i + 1 < segments.length) {
            i++;
            const next = segments[i];
            seg.content = seg.content + '\n\n' + next.content;
            seg.wordCount += next.wordCount;
            seg.estimatedMinutes = Math.round((seg.wordCount * 1.2) / 130);
            seg.thematic_note = seg.thematic_note + ' + ' + next.thematic_note;
        }
        merged.push(seg);
        i++;
    }

    // Si le dernier segment est encore trop court (cas dernier chapitre), fusionner avec l'avant-dernier
    if (merged.length >= 2 && merged[merged.length - 1].wordCount < minWords) {
        const last = merged.pop();
        const prev = merged[merged.length - 1];
        console.log(`[rebalance] Dernier segment trop court (${last.wordCount} mots) → fusionné avec "${prev.title}"`);
        prev.content = prev.content + '\n\n' + last.content;
        prev.wordCount += last.wordCount;
        prev.estimatedMinutes = Math.round((prev.wordCount * 1.2) / 130);
        prev.thematic_note = prev.thematic_note + ' + ' + last.thematic_note;
    }

    // Split des segments trop longs
    const result = [];
    for (const seg of merged) {
        if (seg.wordCount <= maxWords) {
            result.push(seg);
            continue;
        }
        const words = seg.content.split(/\s+/);
        const midChar = words.slice(0, Math.floor(words.length / 2)).join(' ').length;
        const cutPoint = findSentenceBoundary(seg.content, midChar);
        const part1 = seg.content.substring(0, cutPoint).trim();
        const part2 = seg.content.substring(cutPoint).trim();
        const wc1 = part1.split(/\s+/).filter(w => w).length;
        const wc2 = part2.split(/\s+/).filter(w => w).length;
        result.push({ ...seg, content: part1, wordCount: wc1, estimatedMinutes: Math.round((wc1 * 1.2) / 130), title: seg.title + ' (1/2)' });
        if (part2) result.push({ ...seg, content: part2, wordCount: wc2, estimatedMinutes: Math.round((wc2 * 1.2) / 130), title: seg.title + ' (2/2)' });
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACTION D'UNE SECTION PAR INDICE (pour vérification par chapitre)
// ─────────────────────────────────────────────────────────────────────────────
function extractSectionByIndex(cleanedText, orderIndex) {
    const sections = [];
    let currentLines = null;
    for (const line of cleanedText.split('\n')) {
        if (/^#{1,3}\s+/.test(line)) {
            if (currentLines !== null) sections.push(currentLines.join('\n'));
            currentLines = [line];
        } else if (currentLines !== null) {
            currentLines.push(line);
        }
    }
    if (currentLines !== null) sections.push(currentLines.join('\n'));
    if (sections.length === 0) return cleanedText;
    const idx = Math.max(0, Math.min(orderIndex, sections.length - 1));
    return sections[idx];
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉCOUPAGE STORYLINE : extrait les vrais chapitres d'un .docx (texte nettoyé)
// ─────────────────────────────────────────────────────────────────────────────
async function extractStorylineChapters(rawText, projectId = null) {
    // Si le texte est déjà du Markdown structuré (titres Storyline préservés), split + rééquilibrage gratuit
    const headings = (rawText.match(/^#{1,3} .+/gm) || []);
    if (headings.length >= 2) {
        const rawSegments = splitByHeadings(rawText);
        const segments = rebalanceSegments(rawSegments, 600, 780);
        const avgWords = segments.reduce((s, seg) => s + seg.wordCount, 0) / (segments.length || 1);
        console.log(`[CHAPTERS] ${headings.length} titres Markdown → ${segments.length} segments après rééquilibrage, moy. ${Math.round(avgWords)} mots.`);
        return { cleanedText: rawText, segments };
    }

    // Sinon : nettoyage Storyline + découpage IA
    const cleanedText = await cleanStorylineText(rawText);

    if (projectId) {
        await pool.query('UPDATE projects SET cleaned_text = $1 WHERE id = $2', [cleanedText, projectId]);
    }

    if (useMock()) {
        console.log('🤖 [AI] Découpage (Mock)...');
        const mockSegments = [
            {
                title: "Présentation du module",
                content: cleanedText.substring(0, 1000) || "Contenu fictif 1",
                wordCount: 800,
                thematic_note: "Premier module de découverte"
            },
            {
                title: "Concepts clés",
                content: cleanedText.substring(1000, 2000) || "Contenu fictif 2",
                wordCount: 950,
                thematic_note: "Notions fondamentales"
            },
            {
                title: "Mise en pratique",
                content: cleanedText.substring(2000, 3000) || "Contenu fictif 3",
                wordCount: 750,
                thematic_note: "Application pratique"
            }
        ];
        return { 
            cleanedText, 
            segments: mockSegments.map(seg => ({
                ...seg,
                estimatedMinutes: Math.round((seg.wordCount * 1.2) / 130)
            })) 
        };
    }

    const prompt = `Tu es un expert en pédagogie audio.

Voici le contenu brut d'un cours. Tu dois le regrouper en podcasts de maximum 8 minutes.
Le dialogue généré sera environ 2 à 3 fois plus long que le contenu source (reformulations, questions, exemples).
Adapte donc le nombre de podcasts à la densité réelle du contenu : si tout tient en un podcast, fais-en un seul.

RÈGLES ABSOLUES :
1. Chaque podcast = une unité thématique cohérente et compréhensible à l'oral
2. Fusionner les sujets courts et proches thématiquement pour éviter les épisodes trop légers
3. Tout le contenu source doit être conservé, aucune information ne doit être perdue
4. Maximum 8 minutes par podcast (≈ 1200 mots de dialogue généré)
5. Les titres doivent être accrocheurs et parlants pour un apprenant : "Comprendre ce qu'est X" pas "Introduction"

CONTENU SOURCE :
${cleanedText}

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après :
{
  "segments": [
    {
      "title": "Titre accrocheur du podcast",
      "content": "Tout le contenu source correspondant, mot pour mot, sans résumer",
      "wordCount": 850,
      "thematic_note": "En une phrase : quel est le fil conducteur de ce podcast ?"
    }
  ]
}`;

    const parsed = await callWebhook({ type: 'extract-chapters', cleanedText });
    if (!parsed) throw new Error('MAKE_WEBHOOK_URL non configurée — découpage impossible');
    
    let segments = parsed.segments || [];
    segments = segments.map(seg => {
        const actualWordCount = seg.content.split(/\s+/).length;
        if (actualWordCount < 500 || actualWordCount > 1400) {
            console.warn(`[WARNING] Segment "${seg.title}" a un wordCount hors tolérances : ${actualWordCount}`);
        }
        return {
            ...seg,
            wordCount: actualWordCount,
            estimatedMinutes: Math.round(actualWordCount / 150)
        };
    });

    return { cleanedText, segments };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /generate  (génération depuis contenu brut)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE] Début');
        const { projectId, content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Contenu requis' });
        }

        const charRow = projectId
            ? await pool.query('SELECT character_1_name, character_2_name FROM projects WHERE id = $1', [projectId])
            : { rows: [] };
        const char1 = charRow.rows[0]?.character_1_name || 'Inès';
        const char2 = charRow.rows[0]?.character_2_name || 'Yannick';

        const targetDuration = 6;
        const targetWords = targetDuration * 130;
        const prompt = `
Tu es un générateur de podcasts pédagogiques EISF (École Internationale du Savoir-Faire Français).

RÈGLE DE FIDÉLITÉ AU SOURCE :
- Reformuler le contenu source = AUTORISÉ (paraphrase, analogies tirées du domaine)
- N'INVENTE JAMAIS de faits, chiffres, dates, noms techniques ou informations absents du contenu source
- En particulier : n'invente JAMAIS de nouveaux types, catégories, ou variantes qui ne figurent pas explicitement dans le source
- Si tu veux enrichir avec un exemple ou contexte NON PRÉSENT dans le source → marque-le UNIQUEMENT dans text_studio : [PROPOSITION: ton ajout ici]
- Le text_reading ne contient JAMAIS de balise [PROPOSITION]
- En cas de doute sur un fait : ne l'inclus pas, ou marque-le [PROPOSITION]

CONTRAINTES STRICTES :
- Durée : ${targetDuration} minutes (${targetWords} mots)
- Personnages : ${char1} (70%) et ${char2} (30%)
- ${char1} = experte, ton posé, professionnel. Explique les concepts clairement.
- ${char2} = apprenant curieux, spontané. Pose des questions, reformule, fait des liens concrets.
- Structure : Intro (accroche sur le sujet, 30s) + Contenu avec quiz intégré (3-5min) + Conclusion (résumé sur le sujet, 30s)
- ATTENTION : L'introduction officielle et la conclusion légale seront ajoutées automatiquement. Commence directement le dialogue par l'accroche sur le cours.
- Quiz : Intégré naturellement dans le dialogue, pas de section séparée
- Ton conversationnel et naturel (pas "Chers auditeurs", pas "Bienvenue dans ce cours")
${NORMALIZATION_INSTRUCTIONS}
${ORAL_NATURALNESS_INSTRUCTIONS}
CONTENU SOURCE :
${content}
GÉNÈRE LE DIALOGUE AU FORMAT JSON UNIQUEMENT (pas de texte avant/après) :
{
  "title": "Titre accrocheur du podcast (max 50 caractères)",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "intro"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}
VÉRIFIE AVANT D'ENVOYER :
✅ Pas de jingle artificiel à générer, l'introduction est ajoutée en dur.
✅ Ratio ${char1}/${char2} ≈ 70/30
✅ Durée totale = ${targetDuration} min (±30 secondes OK)
✅ Ton conversationnel, quiz intégré
✅ JSON valide avec text_studio ET text_reading`;

        let generatedText;

        if (useMock()) {
            console.log('⚠️ [AI] Mock generation');
            await new Promise(r => setTimeout(r, 1500));
            generatedText = JSON.stringify({
                title: "Podcast Mock : La Fabrication du Fromage",
                dialogues: [
                    { character: "ines", text: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", section: "jingle" },
                    { character: "ines", text: "Bonjour à tous. Aujourd'hui, nous allons découvrir les secrets de la fabrication du fromage.", section: "intro" },
                    { character: "yannick", text: "Ça a l'air délicieux ! Par quoi on commence ?", section: "intro" },
                    { character: "ines", text: "Tout commence par le lait. Sa qualité est essentielle.", section: "content" },
                    { character: "yannick", text: "Et ensuite, c'est l'étape du caillage, c'est ça ?", section: "content" },
                    { character: "ines", text: "Exactement. C'est là que la magie opère.", section: "conclusion" }
                ]
            });
        } else {
            console.log('🤖 [AI] Appel Make webhook...');
            generatedText = await callWebhook({
                type: 'generate',
                sourceText: content,
                targetDuration,
                targetWords: targetWords,
                previousChapter: null,
                nextChapter: null,
                character_1_name: char1,
                character_2_name: char2,
            });
            if (!generatedText) throw new Error('Génération impossible : Make n\'a pas renvoyé de contenu valide (réponse vide, non-JSON, ou JSON invalide). Consulte les logs [callWebhook] pour le détail.');
            console.log('[AI] Réponse Make reçue.');
        }

        const dialogue = generatedText;

        const normalized = dialogue.dialogues.map(line => ({
            ...line,
            text_studio: normalizeText(line.text || line.text_studio || ''),
            text_reading: line.text || line.text_reading || '',
        }));

        // AJOUT EN DUR DES PHRASES OBLIGATOIRES
        normalized.unshift({
            character: 'ines',
            text_studio: INTRO_TEXT,
            text_reading: INTRO_READING,
            section: 'jingle'
        });
        normalized.push({
            character: 'ines',
            text_studio: OUTRO_TEXT,
            text_reading: OUTRO_READING,
            section: 'conclusion'
        });

        const actualWordCount = normalized.reduce((sum, d) => sum + d.text_reading.split(/\s+/).length, 0);

        const podcastResult = await pool.query(
            'INSERT INTO podcasts (project_id, title, word_count, duration_seconds, segment_content) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [projectId, dialogue.title, actualWordCount, targetDuration * 60, content]
        );
        const podcastId = podcastResult.rows[0].id;

        for (let i = 0; i < normalized.length; i++) {
            const d = normalized[i];
            const wordCount = d.text_reading.split(/\s+/).length;
            const estimatedDuration = Math.round((wordCount / 150) * 60);
            await pool.query(
                'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [podcastId, i, d.character, sanitizeBreakTimes(d.text_studio), d.text_reading, estimatedDuration, d.section]
            );
        }

        res.json({ podcastId, title: dialogue.title, wordCount: actualWordCount, dialogueCount: normalized.length });

    } catch (error) {
        console.error('[GENERATE] Erreur:', error);
        if (error.code === 'MAKE_QUOTA_EXCEEDED') {
            return res.status(429).json({ error: 'quota_make_exceeded', message: 'Le quota Make est temporairement dépassé. Réessayez dans quelques minutes.' });
        }
        res.status(500).json({ error: 'Erreur lors de la génération', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /generate-from-project
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-from-project', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE-PROJECT] Début');
        const { projectId, segments } = req.body;

        const projectRow = await pool.query('SELECT cleaned_text, character_1_name, character_2_name FROM projects WHERE id = $1', [projectId]);
        if (projectRow.rows.length === 0) return res.status(404).json({ error: 'Projet non trouvé' });
        const char1 = projectRow.rows[0].character_1_name || 'Inès';
        const char2 = projectRow.rows[0].character_2_name || 'Yannick';

        let segmentsToGenerate = segments;
        if (!segmentsToGenerate || segmentsToGenerate.length === 0) {
            segmentsToGenerate = [{ title: 'Podcast Pédagogique', content: projectRow.rows[0].cleaned_text }];
        }

        if (useMock()) {
            console.log('[GENERATE-PROJECT] ⚠️ Mock AI');
            await new Promise(r => setTimeout(r, 1000));
            let allPodcasts = [];
            for (let idx = 0; idx < segmentsToGenerate.length; idx++) {
                const segment = segmentsToGenerate[idx];
                const mockDialogues = [
                    { character: "ines", text_studio: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", text_reading: "Ceci est un podcast produit à partir des cours originaux de l'É I S F.", section: "jingle" },
                    { character: "ines", text_studio: "Bonjour, aujourd'hui nous découvrons : " + segment.title, text_reading: "Bonjour, aujourd'hui nous découvrons : " + segment.title, section: "intro" },
                    { character: "yannick", text_studio: "C'est super excitant ! Par quoi on commence ?", text_reading: "C'est super excitant ! Par quoi on commence ?", section: "content" },
                    { character: "ines", text_studio: "Voici les premiers principes à retenir.", text_reading: "Voici les premiers principes à retenir.", section: "content" },
                    { character: "yannick", text_studio: "Parfait, c'est très clair merci !", text_reading: "Parfait, c'est très clair merci !", section: "conclusion" }
                ];
                const podcastResult = await pool.query(
                    'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds, segment_content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [projectId, segment.title, idx, 60, 120, segment.content]
                );
                const podcastId = podcastResult.rows[0].id;
                allPodcasts.push({ podcastId, title: segment.title });
                for (let i = 0; i < mockDialogues.length; i++) {
                    const d = mockDialogues[i];
                    await pool.query(
                        'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [podcastId, i, d.character, d.text_studio, d.text_reading, 24, d.section]
                    );
                }
            }
            return res.json({ success: true, podcasts: allPodcasts });
        }

        let allPodcasts = [];

        for (let idx = 0; idx < segmentsToGenerate.length; idx++) {
            const segment = segmentsToGenerate[idx];
            console.log(`[GENERATE-PROJECT] Segment ${idx + 1}/${segmentsToGenerate.length} : ${segment.title}`);

            if (!segment.content || segment.content.trim().length < 20) continue;

            const prompt = `Tu es un scénariste de podcast pédagogique pour l'EISF (École Internationale du Savoir-Faire Français).
Génère un dialogue naturel entre ${char1} (experte, 70% du temps) et ${char2} (apprenant, 30%).

RÈGLE DE FIDÉLITÉ AU SOURCE :
- Reformuler le contenu source = AUTORISÉ (paraphrase, analogies tirées du domaine)
- N'INVENTE JAMAIS de faits, chiffres, dates, noms techniques ou informations absents du contenu source
- En particulier : n'invente JAMAIS de nouveaux types, catégories, ou variantes qui ne figurent pas explicitement dans le source
- Si tu veux enrichir avec un exemple ou contexte NON PRÉSENT dans le source → marque-le UNIQUEMENT dans text_studio : [PROPOSITION: ton ajout ici]
- Le text_reading ne contient JAMAIS de balise [PROPOSITION]
- En cas de doute sur un fait : ne l'inclus pas, ou marque-le [PROPOSITION]

RÈGLES DE TRANSFORMATION AUDIO (obligatoires) :
- Reformuler tout le jargon technique en langage parlé
  Exemple : "Le taux de cendres, c'est simplement un indicateur pour savoir si ta farine est plutôt blanche ou complète"
- Ajouter systématiquement : exemples concrets, analogies visuelles, liens avec une pâte ou une recette réelle
- ${char2} pose les questions qu'un apprenti se pose vraiment (pas des questions génériques)
- ${char1} répond avec des exemples tirés du métier
- Prévoir des micro-reformulations ("donc si je résume...", "attends, tu veux dire que...")
  pour ancrer la mémorisation
- Structure obligatoire :
  1. Intro : relier ce podcast au précédent en 1 phrase (PAS DE JINGLE OFFICIEL, il est mis en dur)
  2. Contenu : tout le contenu source transformé (rien ne peut être omis)
  3. Conclusion : 1 phrase de résumé + 1 annonce du prochain podcast
${NORMALIZATION_INSTRUCTIONS}
${ORAL_NATURALNESS_INSTRUCTIONS}

TITRE DE L'ÉPISODE : ${segment.title}
CONTENU SOURCE À TRANSFORMER (tout garder, aucun concept ne doit être omis) :
${segment.content}

Durée cible : 5 à 8 minutes (750 à 1200 mots au total)

Réponds UNIQUEMENT en JSON valide :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "intro"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

            const rawText = await callWebhook({
                type: 'generate',
                sourceText: segment.content,
                chapterTitle: segment.title,
                targetDuration: 6,
                targetWords: Math.round(6 * 130),
                previousChapter: null,
                nextChapter: null,
                character_1_name: char1,
                character_2_name: char2,
            });
            if (!rawText) throw new Error('Génération impossible : Make n\'a pas renvoyé de contenu valide (réponse vide, non-JSON, ou JSON invalide). Consulte les logs [callWebhook] pour le détail.');
            console.log(`[GENERATE-PROJECT] Make répondu pour segment ${idx + 1}`);

            const dialogue = rawText;
            const dialoguesNorm = (dialogue.dialogues || []).map(line => ({
                ...line,
                text_studio: normalizeText(line.text_studio || line.text || ''),
                text_reading: line.text_reading || line.text_studio || line.text || '',
            }));

            // AJOUT EN DUR DES PHRASES OBLIGATOIRES
            dialoguesNorm.unshift({ character: 'ines', text_studio: INTRO_TEXT, text_reading: INTRO_READING, section: 'jingle' });
            dialoguesNorm.push({ character: 'ines', text_studio: OUTRO_TEXT, text_reading: OUTRO_READING, section: 'conclusion' });

            const actualWordCount = dialoguesNorm.reduce((sum, d) => sum + (d.text_reading ? d.text_reading.split(/\s+/).length : 0), 0);
            const durationSecs = Math.round((actualWordCount / 130) * 60);

            const podcastResult = await pool.query(
                'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds, segment_content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [projectId, dialogue.title, idx, actualWordCount, durationSecs, segment.content]
            );
            const podcastId = podcastResult.rows[0].id;
            allPodcasts.push({ podcastId, title: dialogue.title });

            for (let i = 0; i < dialoguesNorm.length; i++) {
                const d = dialoguesNorm[i];
                const wCount = d.text_reading ? d.text_reading.split(/\s+/).length : 0;
                const eDuration = Math.round((wCount / 130) * 60);
                await pool.query(
                    'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [podcastId, i, d.character || 'ines', sanitizeBreakTimes(d.text_studio), d.text_reading || d.text_studio, eDuration, d.section || 'content']
                );
            }

            // Pause entre segments pour éviter le rate limit
            if (idx < segmentsToGenerate.length - 1) {
                await new Promise(r => setTimeout(r, 4000));
            }

        }
        console.log('[GENERATE-PROJECT] ✅ Terminé, podcasts créés:', allPodcasts.length);
        res.json({ success: true, podcasts: allPodcasts });
    } catch (error) {
        console.error('[GENERATE-PROJECT] Erreur:', error);
        res.status(500).json({ error: 'Erreur génération IA', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper : génère un slug pour le nommage des podcasts
// ─────────────────────────────────────────────────────────────────────────────
function slugify(str) {
    return (str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .substring(0, 30)
        .replace(/_+$/, '');
}

function buildPodcastTitle(orderIndex, projectTitle, chapterTitle) {
    const num = (orderIndex || 0) + 1;
    const clean = (chapterTitle || '').replace(/^#+\s*/, '').trim();
    return clean ? `Chapitre ${num} — ${clean}` : `Chapitre ${num}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /generate-single-chapter
// ─────────────────────────────────────────────────────────────────────────────
router.post('/generate-single-chapter', authMiddleware, async (req, res) => {
    try {
        console.log('[GENERATE-SINGLE] Début');
        const { projectId, segment, orderIndex, previousChapter, nextChapter } = req.body;
        const targetDuration = 6;

        if (!segment || !segment.content) {
            return res.status(400).json({ error: 'Segment content is required' });
        }

        // Récupérer le titre et les prénoms du projet
        const projTitleRes = await pool.query('SELECT title, character_1_name, character_2_name FROM projects WHERE id = $1', [projectId]);
        const projectTitle = projTitleRes.rows[0]?.title || '';
        const char1 = projTitleRes.rows[0]?.character_1_name || 'Inès';
        const char2 = projTitleRes.rows[0]?.character_2_name || 'Yannick';

        if (useMock()) {
            console.log('[GENERATE-SINGLE] ⚠️ Mock AI');
            await new Promise(r => setTimeout(r, 1000));
            const mockDialogues = [
                { character: "ines", text_studio: "Ceci est un podcast produit à partir des cours originaux de l'EISF.", text_reading: "Ceci est un podcast produit à partir des cours originaux de l'É I S F.", section: "jingle" },
                { character: "ines", text_studio: "Aujourd'hui sur ce segment : " + segment.title, text_reading: "Aujourd'hui sur ce segment : " + segment.title, section: "intro" },
                { character: "yannick", text_studio: "Allons-y !", text_reading: "Allons-y !", section: "content" },
                { character: "ines", text_studio: "Voilà l'essentiel.", text_reading: "Voilà l'essentiel.", section: "conclusion" }
            ];

            const actualWordCount = 60;
            const durationSecs = 120;
            const mockTitle = buildPodcastTitle(orderIndex, projectTitle, segment.title);
            const podcastResult = await pool.query(
                'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [projectId, mockTitle, orderIndex || 0, actualWordCount, durationSecs]
            );
            const podcastId = podcastResult.rows[0].id;
            
            for (let i = 0; i < mockDialogues.length; i++) {
                const d = mockDialogues[i];
                await pool.query(
                    'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                    [podcastId, i, d.character, d.text_studio, d.text_reading, 24, d.section]
                );
            }

            return res.json({
                podcastId,
                title: segment.title,
                wordCount: actualWordCount,
                durationSeconds: durationSecs,
                dialogueCount: mockDialogues.length
            });
        }

        const prompt = `Tu es un scénariste de podcast pédagogique pour l'EISF (École Internationale du Savoir-Faire Français).
Génère un dialogue naturel entre ${char1} (experte, 70% du temps) et ${char2} (apprenant, 30%).

RÈGLE ABSOLUE — FIDÉLITÉ AU SOURCE :
- Reformuler le contenu source = AUTORISÉ (paraphrase, analogies tirées du domaine)
- N'INVENTE JAMAIS de faits, chiffres, dates, noms techniques ou informations absents du contenu source
- En particulier : n'invente JAMAIS de nouveaux types, catégories, ou variantes qui ne figurent pas explicitement dans le source (ex : si le source mentionne "blé tendre" et "blé dur", n'invente pas de troisième type)
- Si tu veux enrichir avec un exemple ou contexte NON PRÉSENT dans le source → marque-le UNIQUEMENT dans text_studio : [PROPOSITION: ton ajout ici]
- Le text_reading ne contient JAMAIS de balise [PROPOSITION]
- En cas de doute sur un fait : ne l'inclus pas, ou marque-le [PROPOSITION]

RÈGLES DE TRANSFORMATION AUDIO (obligatoires) :
- Reformuler tout le jargon technique en langage parlé et accessible
- ${char2} pose les questions qu'un apprenant se pose vraiment (pas des questions génériques)
- ${char1} répond en s'appuyant sur le contenu source uniquement (ou propose via [PROPOSITION: ...])
- Prévoir des micro-reformulations ("donc si je résume...", "attends, tu veux dire que...")
  pour ancrer la mémorisation
- Structure obligatoire :
  1. Intro : relier ce podcast au précédent en 1 phrase (PAS DE JINGLE OFFICIEL, il est mis en dur)
  2. Contenu : tout le contenu source transformé (rien ne peut être omis)
  3. Conclusion : 1 phrase de résumé + 1 annonce du prochain podcast
${NORMALIZATION_INSTRUCTIONS}
${ORAL_NATURALNESS_INSTRUCTIONS}

TITRE DE L'ÉPISODE : ${segment.title}
CONTENU SOURCE À TRANSFORMER (tout garder, aucun concept ne peut être omis) :
${segment.content}

Durée cible : ${targetDuration} minutes (≈ ${Math.round(targetDuration * 130)} mots de dialogue au total).
Si le contenu source ne suffit pas à atteindre cette durée sans invention, complète avec des [PROPOSITION: ...] pédagogiquement cohérents (exemples concrets du domaine, cas pratiques, reformulations approfondies) — jamais de faits non vérifiables.

Réponds UNIQUEMENT en JSON valide :
{
  "title": "${segment.title}",
  "dialogues": [
    {"character": "ines", "text_studio": "...", "text_reading": "...", "section": "intro"},
    {"character": "yannick", "text_studio": "...", "text_reading": "...", "section": "intro"}
  ]
}`;

        console.log(`[GENERATE-SINGLE] Appel Make pour ${segment.title}...`);
        const rawText = await callWebhook({
            type: 'generate',
            sourceText: segment.content,
            chapterTitle: segment.title,
            targetDuration,
            targetWords: Math.round(targetDuration * 130),
            previousChapter: previousChapter ? { title: previousChapter.title, wordCount: previousChapter.wordCount } : null,
            nextChapter: nextChapter ? { title: nextChapter.title, wordCount: nextChapter.wordCount } : null,
            character_1_name: char1,
            character_2_name: char2,
        });
        if (!rawText) throw new Error('Génération impossible : Make n\'a pas renvoyé de contenu valide (réponse vide, non-JSON, ou JSON invalide). Consulte les logs [callWebhook] pour le détail.');

        if (typeof rawText === 'string') {
            console.error('[GENERATE-SINGLE] Réponse Make non parsable en JSON. Début réponse brute:', rawText.substring(0, 500));
            throw new Error('Make a retourné une réponse non-JSON — vérifiez les logs [GENERATE-SINGLE]');
        }

        const dialogue = rawText;
        if (!Array.isArray(dialogue.dialogues) || dialogue.dialogues.length === 0) {
            console.error('[GENERATE-SINGLE] Structure Make invalide — dialogues absent ou vide. Réponse:', JSON.stringify(rawText).substring(0, 500));
            throw new Error('Structure de réponse Make invalide : clé dialogues absente ou vide');
        }

        const dialoguesNormalized = dialogue.dialogues.map(line => ({
            ...line,
            text_studio: normalizeText(line.text_studio || line.text || ''),
            text_reading: line.text_reading || line.text_studio || line.text || '',
        }));

        // AJOUT EN DUR DES PHRASES OBLIGATOIRES
        dialoguesNormalized.unshift({ character: 'ines', text_studio: INTRO_TEXT, text_reading: INTRO_READING, section: 'jingle' });
        dialoguesNormalized.push({ character: 'ines', text_studio: OUTRO_TEXT, text_reading: OUTRO_READING, section: 'conclusion' });

        const actualWordCount = dialoguesNormalized.reduce((sum, d) => sum + (d.text_reading ? d.text_reading.split(/\s+/).length : 0), 0);
        const durationSecs = Math.round((actualWordCount / 130) * 60); // Roughly 130 words per min

        const finalTitle = buildPodcastTitle(orderIndex, projectTitle, segment.title);
        const podcastResult = await pool.query(
            'INSERT INTO podcasts (project_id, title, order_index, word_count, duration_seconds, segment_content) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [projectId, finalTitle, orderIndex || 0, actualWordCount, durationSecs, segment.content]
        );
        const podcastId = podcastResult.rows[0].id;

        for (let i = 0; i < dialoguesNormalized.length; i++) {
            const d = dialoguesNormalized[i];
            const wCount = d.text_reading ? d.text_reading.split(/\s+/).length : 0;
            const eDuration = Math.round((wCount / 130) * 60);
            await pool.query(
                'INSERT INTO dialogues (podcast_id, order_index, character, text_studio, text_reading, duration_seconds, section) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [podcastId, i, d.character || 'ines', sanitizeBreakTimes(d.text_studio), d.text_reading, eDuration, d.section || 'content']
            );
        }

        console.log('[GENERATE-SINGLE] ✅ Podcast créé:', podcastId, '→', finalTitle);
        res.json({
            podcastId,
            title: finalTitle,
            wordCount: actualWordCount,
            durationSeconds: durationSecs,
            dialogueCount: dialoguesNormalized.length
        });

    } catch (error) {
        console.error('[GENERATE-SINGLE] Erreur:', error);
        if (error.code === 'MAKE_QUOTA_EXCEEDED') {
            return res.status(429).json({ error: 'quota_make_exceeded', message: 'Le quota Make est temporairement dépassé. Réessayez dans quelques minutes.' });
        }
        res.status(500).json({ error: 'Erreur génération podcast', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /preview  — extrait les chapitres du .docx et procède au nettoyage + découpe
// ─────────────────────────────────────────────────────────────────────────────
router.post('/preview', authMiddleware, async (req, res) => {
    try {
        const { projectId } = req.body;

        // Récupérer le chemin du fichier
        const projectResult = await pool.query(
            'SELECT source_file_path, title, cleaned_text FROM projects WHERE id = $1 AND user_id = $2',
            [projectId, req.userId]
        );

        if (projectResult.rows.length === 0) {
            return res.status(404).json({ error: 'Projet non trouvé' });
        }

        const { source_file_path, title, cleaned_text: existingCleanedText } = projectResult.rows[0];

        // Si cleaned_text est déjà du Markdown structuré (import récent), l'utiliser directement
        let rawText = '';
        const hasMarkdownHeadings = existingCleanedText && (existingCleanedText.match(/^#{1,3} .+/gm) || []).length >= 2;
        if (hasMarkdownHeadings) {
            console.log(`[PREVIEW] Markdown déjà disponible en base → skip extraction Word.`);
            rawText = existingCleanedText;
        } else if (source_file_path) {
            const result = await mammoth.extractRawText({ path: source_file_path });
            rawText = result.value || '';
        } else if (existingCleanedText) {
            rawText = existingCleanedText;
        } else {
            return res.status(400).json({ error: 'Aucun fichier ni texte source trouvé pour ce projet.' });
        }

        // Appel à la nouvelle logique de nettoyage et de découpage IA
        console.log(`[PREVIEW] Découpage IA de "${title}" (Projet #${projectId})...`);
        const { cleanedText, segments } = await extractStorylineChapters(rawText, projectId);
        
        const lines = cleanedText.split('\n');
        const wordCount = cleanedText.split(/\s+/).length;

        console.log(`[PREVIEW] Succès. ${segments.length} segments extraits.`);

        res.json({
            projectTitle: title,
            wordCount,
            lineCount: lines.length,
            cleanedText,                  // Le texte complet nettoyé
            chapters: segments,           // Les segments détectés par l'IA (+ mock fallback)
            rawLinesPreview: lines.slice(0, 30), // Aperçu des premières lignes
        });

    } catch (error) {
        console.error('[PREVIEW] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la prévisualisation' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /regenerate-line
// ─────────────────────────────────────────────────────────────────────────────
router.post('/regenerate-line', authMiddleware, async (req, res) => {
    try {
        const { dialogueId, currentText, style, contextBefore, contextAfter } = req.body;

        if (useMock()) {
            return res.json({ text_studio: currentText + ' [reformulé]', text_reading: currentText + ' [reformulé]' });
        }

        const prompt = `Tu es un scénariste de podcast pédagogique. Reformule UNE réplique de manière naturelle sans casser la continuité.
CONTEXTE AVANT:
${(contextBefore || []).join('\n')}
RÉPLIQUE À REFORMULER:
${currentText}
CONTEXTE APRÈS:
${(contextAfter || []).join('\n')}
Mode: "${style}" (simplify: rends très simple, detail: ajoute des détails pédagogiques, rephrase: change la tournure).
Génère UNIQUEMENT ce JSON :
{
  "text_studio": "La nouvelle réplique",
  "text_reading": "La nouvelle réplique"
}`;

        const dialogue = await callWebhook({ type: 'regenerate-line', currentText, style, contextBefore, contextAfter });
        if (!dialogue) throw new Error('MAKE_WEBHOOK_URL non configurée');

        await pool.query(
            'UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3',
            [sanitizeBreakTimes(dialogue.text_studio), dialogue.text_reading || dialogue.text_studio, dialogueId]
        );

        res.json({ text_studio: dialogue.text_studio, text_reading: dialogue.text_reading || dialogue.text_studio });

    } catch (error) {
        console.error('[REGENERATE] Erreur:', error);
        res.status(500).json({ error: 'Erreur lors de la régénération', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /verify
// ─────────────────────────────────────────────────────────────────────────────
router.post("/verify", async (req, res) => {
  try {
    const { segmentContent, scriptText } = req.body;

    if (!segmentContent || !scriptText) {
      return res.status(400).json({
        error: "Paramètres manquants : segmentContent et scriptText sont requis"
      });
    }

    const verificationResult = await verifyScriptAgainstSource(segmentContent, scriptText);

    return res.json({
      success: true,
      fidelityScore: verificationResult.fidelityScore,
      totalConcepts: verificationResult.totalConcepts,
      validatedConcepts: verificationResult.validatedConcepts,
      missingConcepts: verificationResult.missingConcepts,
      details: verificationResult.allResults
    });

  } catch (error) {
    console.error("Erreur /verify :", error);
    if (error.code === 'MAKE_QUOTA_EXCEEDED') {
        return res.status(429).json({ error: 'quota_make_exceeded', message: 'Le quota Make est temporairement dépassé. Réessayez dans quelques minutes.' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /fix-missing-concepts
// ─────────────────────────────────────────────────────────────────────────────
router.post('/fix-missing-concepts', authMiddleware, async (req, res) => {
    try {
        const { podcastId, missingConcepts } = req.body;

        const dialoguesRes = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );
        const dialogues = dialoguesRes.rows;
        const dialogueText = dialogues.map((d, i) => `[ID:${i} - ${d.character}] ${d.text_studio}`).join('\n');

        if (useMock()) {
            return res.json({ updatedDialogues: [] });
        }

        const correctedScript = await callWebhook({
            type: 'fix-missing-concepts',
            prompt: `Tu reçois un script de podcast et une liste de concepts absents.\nInjecte chaque concept naturellement dans une réplique existante.\nNe change pas le ton. Ne crée pas de nouvelles répliques.\nRetourne le script complet modifié en JSON avec la même structure (tableau de dialogues avec id, character, text_studio, text_reading, section).\nRéponds UNIQUEMENT en JSON valide, sans markdown.\n\nCONCEPTS MANQUANTS:\n${missingConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nSCRIPT:\n${dialogueText}`
        });

        if (!correctedScript) {
            return res.status(502).json({ error: 'Make n\'a pas répondu pour la correction des concepts' });
        }

        const corrected = Array.isArray(correctedScript) ? correctedScript : (correctedScript.dialogues || []);

        const client = await pool.connect();
        const updatedDialogues = [];
        try {
            await client.query('BEGIN');
            for (const d of corrected) {
                if (!d.id) continue;
                await client.query(
                    'UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3 AND podcast_id = $4',
                    [d.text_studio || '', d.text_reading || d.text_studio || '', d.id, podcastId]
                );
                updatedDialogues.push(d);
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        res.json({ updatedDialogues });

    } catch (error) {
        console.error('[FIX] Erreur:', error);
        if (error.code === 'MAKE_QUOTA_EXCEEDED') {
            return res.status(429).json({ error: 'quota_make_exceeded', message: 'Le quota Make est temporairement dépassé. Réessayez dans quelques minutes.' });
        }
        res.status(500).json({ error: 'Erreur lors de la correction', details: error.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE : /auto-verify-and-fix
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auto-verify-and-fix", async (req, res) => {
  try {
    const { podcastId, targetScore = 95 } = req.body;

    if (!podcastId) {
      return res.status(400).json({ error: "podcastId requis" });
    }

    // ─── Récupérer le contenu source depuis la BDD ─────────────────────────
    const podcastRow = await pool.query(
      'SELECT project_id, order_index, segment_content FROM podcasts WHERE id = $1',
      [podcastId]
    );
    if (podcastRow.rows.length === 0) {
      return res.status(404).json({ error: 'Podcast non trouvé' });
    }
    const { project_id: projectId, order_index: orderIndex, segment_content } = podcastRow.rows[0];

    let segmentContent = segment_content || null;
    if (!segmentContent) {
      const projRow = await pool.query('SELECT cleaned_text FROM projects WHERE id = $1', [projectId]);
      segmentContent = extractSourceSection(projRow.rows[0]?.cleaned_text || '', orderIndex ?? 0);
    }

    // ─── Récupérer les dialogues actuels ──────────────────────────────────
    const dlgRow = await pool.query(
      'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
      [podcastId]
    );
    let currentDialogues = dlgRow.rows;

    // ─── Lire le cache de concepts depuis ia_feedback ─────────────────────
    const feedbackRow = await pool.query('SELECT ia_feedback FROM podcasts WHERE id = $1', [podcastId]);
    let cachedConcepts = feedbackRow.rows[0]?.ia_feedback?.cached_concepts || null;

    let lastScore = 0;
    let passCount = 0;
    const maxPasses = 2;
    const passHistory = [];

    // ─── BOUCLE DE CORRECTION (max 2 passes) ──────────────────────────────
    while (passCount < maxPasses) {
      const currentScriptText = currentDialogues
        .map(d => `${d.character}: ${d.text_reading || d.text_studio}`)
        .join("\n");

      const verif = await verifyScriptAgainstSource(segmentContent, currentScriptText, cachedConcepts);

      if (!cachedConcepts && verif.extractedConcepts?.length > 0) {
        cachedConcepts = verif.extractedConcepts;
        await pool.query(
          "UPDATE podcasts SET ia_feedback = COALESCE(ia_feedback, '{}'::jsonb) || $1::jsonb WHERE id = $2",
          [JSON.stringify({ cached_concepts: cachedConcepts }), podcastId]
        );
      }
      lastScore = verif.fidelityScore;

      passHistory.push({
        pass: passCount + 1,
        score: lastScore,
        missingCount: verif.missingConcepts.length,
        missing: verif.missingConcepts
      });

      if (lastScore >= targetScore) break;
      if (verif.missingConcepts.length === 0) break;

      // ─── APPEL DE CORRECTION (Make) ──────────────────────────────────────
      const fixText = await callWebhook({
        type: 'fix-missing-concepts',
        prompt: `Tu es un correcteur de script de podcast pédagogique.\nOn te donne un script existant (JSON) et une liste de concepts manquants tirés du contenu source.\nRÈGLES STRICTES :\n- Intégrer les concepts manquants naturellement dans le dialogue entre Inès et Yannick\n- Ne jamais supprimer ni modifier les répliques existantes — seulement en ajouter ou les enrichir\n- Respecter le style oral (tics de langage, balises <break>, hésitations)\n- Réponds UNIQUEMENT avec un tableau JSON des répliques modifiées ou ajoutées (pas tout le tableau), sans markdown\n\nCONCEPTS MANQUANTS À INTÉGRER :\n${verif.missingConcepts.map((c, i) => `${i + 1}. ${c}`).join("\n")}\n\nSOURCE :\n${segmentContent}\n\nSCRIPT ACTUEL (JSON) :\n${JSON.stringify(currentDialogues)}`
      }, 120_000);
      if (!fixText) break;

      try {
        const parsed = typeof fixText === 'string' ? JSON.parse(fixText) : fixText;
        const delta = Array.isArray(parsed) ? parsed : (parsed?.dialogues || []);
        const deltaMap = new Map(delta.filter(d => d.id).map(d => [d.id, d]));
        const added = delta.filter(d => !d.id);
        const corrected = [...currentDialogues.map(d => deltaMap.get(d.id) || d), ...added];

        if (!Array.isArray(corrected) || corrected.length === 0) {
          console.error(`[auto-verify-and-fix] Pass ${passCount + 1} : réponse Make invalide ou vide — currentDialogues conservé`, fixText);
          break;
        }

        // ─── SAUVEGARDER EN BDD ─────────────────────────────────────────
        for (const d of corrected) {
          if (d.id) {
            await pool.query(
              'UPDATE dialogues SET text_studio = $1, text_reading = $2 WHERE id = $3 AND podcast_id = $4',
              [d.text_studio || '', d.text_reading || d.text_studio || '', d.id, podcastId]
            );
          }
        }
        currentDialogues = corrected;
      } catch (e) {
        console.error("Échec parsing correction pass", passCount + 1, e.message);
        break;
      }

      passCount++;
    }

    // Mettre à jour le score du podcast en BDD
    await pool.query('UPDATE podcasts SET fidelity_score = $1 WHERE id = $2', [lastScore, podcastId]);

    if (lastScore >= targetScore) {
      console.log('[groundingCheck] Déclenchement — lastScore:', lastScore, 'targetScore:', targetScore);
      await groundingCheck(podcastId, segmentContent);
      console.log('[groundingCheck] Terminé');
    }

    return res.json({
      success: true,
      finalScore: lastScore,
      passCount: passHistory.length,
      targetReached: lastScore >= targetScore,
      passHistory
    });

  } catch (error) {
    console.error("Erreur /auto-verify-and-fix :", error);
    if (error.code === 'MAKE_QUOTA_EXCEEDED') {
        return res.status(429).json({ error: 'quota_make_exceeded', message: 'Le quota Make est temporairement dépassé. Réessayez dans quelques minutes.' });
    }
    return res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation texte (chiffres → lettres, acronymes → phonétique)
// ─────────────────────────────────────────────────────────────────────────────

function unitsToFr(n) {
    const u = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf',
                'dix','onze','douze','treize','quatorze','quinze','seize','dix-sept',
                'dix-huit','dix-neuf'];
    return u[n];
}

function tensToFr(n) {
    if (n < 20) return unitsToFr(n);
    const tens = ['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 7 || t === 9) {
        const base = t === 7 ? 60 : 80;
        const sub = n - base;
        const subStr = sub === 1 && t === 7 ? 'et onze' : (sub < 20 ? unitsToFr(sub) : tensToFr(sub));
        return (t === 9 ? 'quatre-vingt-' : 'soixante-') + subStr;
    }
    if (u === 0) return tens[t] + (t === 8 ? 's' : '');
    if (u === 1 && t !== 8) return tens[t] + '-et-un';
    return tens[t] + '-' + unitsToFr(u);
}

function intToFr(n) {
    if (n < 0) return 'moins ' + intToFr(-n);
    if (n < 100) return tensToFr(n);
    if (n < 1000) {
        const c = Math.floor(n / 100);
        const r = n % 100;
        const centStr = c === 1 ? 'cent' : (unitsToFr(c) + ' cent' + (r === 0 && c > 1 ? 's' : ''));
        return r === 0 ? centStr : centStr + ' ' + tensToFr(r);
    }
    if (n < 1000000) {
        const m = Math.floor(n / 1000);
        const r = n % 1000;
        const milleStr = m === 1 ? 'mille' : intToFr(m) + ' mille';
        return r === 0 ? milleStr : milleStr + ' ' + intToFr(r);
    }
    const m = Math.floor(n / 1000000);
    const r = n % 1000000;
    const millionStr = intToFr(m) + ' million' + (m > 1 ? 's' : '');
    return r === 0 ? millionStr : millionStr + ' ' + intToFr(r);
}

function numberToFr(str) {
    // Gère décimales : "3,5" ou "3.5"
    if (/^\d+[,\.]\d+$/.test(str)) {
        const parts = str.replace(',', '.').split('.');
        return intToFr(parseInt(parts[0])) + ' virgule ' + parts[1].split('').map(d => unitsToFr(parseInt(d))).join(' ');
    }
    return intToFr(parseInt(str));
}

function normalizeText(text) {
    let normalized = text;

    // Chiffres isolés → lettres (pas ceux déjà dans une parenthèse phonétique)
    normalized = normalized.replace(/(?<!\()\b(\d{1,7}(?:[,\.]\d+)?)\b(?!\s*\))/g, (match) => {
        try { return numberToFr(match); } catch { return match; }
    });

    // Unités courantes après conversion
    normalized = normalized.replace(/(\w+)\s*%/g, '$1 pourcent');
    normalized = normalized.replace(/(\w+)\s*€/g, '$1 euros');
    normalized = normalized.replace(/(\w+)\s*°C/g, '$1 degrés Celsius');
    normalized = normalized.replace(/(\w+)\s*°/g, '$1 degrés');
    normalized = normalized.replace(/\s*&\s*/g, ' et ');

    // Acronymes → phonétique (uniquement si pas déjà suivi d'une parenthèse)
    const acronymMap = {
        'EISF':  'EISF (E.I.S.F.)',
        'DLC':   'DLC (Dé-El-Cé)',
        'HACCP': 'HACCP (Ha-A-Cé-Cé-Pé)',
        'DLUO':  'DLUO (Dé-El-U-O)',
        'IGP':   'IGP (I-Gé-Pé)',
        'AOP':   'AOP (A-O-Pé)',
        'AOC':   'AOC (A-O-Cé)',
        'CAP':   'CAP (Cé-A-Pé)',
        'BEP':   'BEP (Bé-E-Pé)',
        'BTS':   'BTS (Bé-Té-S)',
        'pH':    'pH (pé-ache)',
        'TVA':   'TVA (Té-Vé-A)',
        'TTC':   'TTC (Té-Té-Cé)',
        'HT':    'HT (Ache-Té)',
    };
    for (const [acronym, phonetic] of Object.entries(acronymMap)) {
        normalized = normalized.replace(new RegExp(`\\b${acronym}\\b(?!\\s*\\()`, 'g'), phonetic);
    }

    return normalized;
}

const ORAL_NATURALNESS_INSTRUCTIONS = `
RÈGLES DE NATUREL ORAL (s'applique UNIQUEMENT à text_studio) :

TICS DE LANGAGE :
- Inès utilise : "Alors...", "C'est-à-dire que", "Et en fait,", "Tu vois ?", "Exactement, et—", "Tout à fait.", "Oui, et c'est là où c'est intéressant—", "C'est ça,", "En plein dans le mille !"
- Yannick utilise : "Euh...", "Ah ouais !", "Attends—", "Donc si je comprends bien...", "Hm...", "D'accord, et du coup—", "Ah ! Et du coup,"
- Chaque réplique de Yannick commence TOUJOURS par une réaction sonore avant sa question ("Ah ! Et du coup...", "Euh... attends,", "Hm… et donc,")
- Inès NE RÉPÈTE JAMAIS le même mot d'amorce deux fois dans le même épisode : si elle a dit "Exactement !" une fois, ce mot est interdit pour le reste de l'épisode — varier systématiquement parmi la liste ci-dessus

TAGS EXPRESSIFS (s'applique UNIQUEMENT à text_studio) :
- Placer UN seul tag entre crochets au DÉBUT de text_studio, immédiatement avant le premier mot parlé.
- NE PAS mettre de tag dans text_reading.
- NE PAS mettre de tag en milieu ou en fin de réplique.
- Tags autorisés et règles d'attribution :
  * [vocal smile]  → Inès : accueil, ouverture chaleureuse, intro d'épisode
  * [newscaster]   → Inès : explication théorique, définition, concept clé, segment factuel
  * [empathetic]   → Inès : encouragement, validation, moment de complicité
  * [empathetic]   → Yannick : question sincère, reformulation, moment de découverte
  * [laughs]       → Yannick : réaction amusée, humour léger, complicité
- Répliques neutres de transition (ex : enchaînement logique sans émotion marquée) : aucun tag.

BALISES DE PAUSE :
- Marquer les pauses longues (après une question forte, après une idée importante) avec : <break time="1.5s" />
- Marquer les pauses courtes (entre deux idées dans la même réplique) avec : <break time="0.8s" />
- CRITIQUE ABSOLUE : les valeurs de durée dans <break> sont TOUJOURS écrites en chiffres : 0.8s, 1.5s — JAMAIS en lettres ("zéro", "un", "deux" sont strictement interdits dans une balise <break>)

PONCTUATION ORALE :
- Utiliser "..." intégré dans la phrase pour les hésitations légères (ex : "C'est... c'est exactement ça.")
- Utiliser le tiret cadratin — pour les coupures nettes ou changements de rythme dans une phrase
- Alterner les longueurs de répliques : certaines très courtes (1 phrase), d'autres plus longues (3-4 phrases)

DISTINCTION text_studio / text_reading :
- text_studio = version ORALE complète avec toutes les marques ci-dessus → sera envoyée à l'API
- text_reading = version PROPRE, sans aucune marque orale, sans balises <break>, sans tags expressifs, sans "Euh", sans "...", sans tirets cadratins → affichée à l'écran uniquement

EXEMPLE OBLIGATOIRE À RESPECTER :
❌ MAUVAIS text_studio : "Le taux de cendres indique la teneur en minéraux de la farine."
✅ BON text_studio    : "[newscaster] Alors... le taux de cendres, c'est — en gros — un indicateur pour savoir si ta farine est blanche ou complète. <break time="1.0s" /> Tu vois le principe ?"

❌ MAUVAIS text_studio : "Euh... j'avais pas pensé à ça."
✅ BON text_studio    : "[empathetic] Euh... j'avais pas pensé à ça, c'est pourtant logique !"

❌ MAUVAIS balise : <break time="zéro.8s" /> ou <break time="un.5s" />
✅ BON balise      : <break time="0.8s" /> ou <break time="1.5s" />
`;

// Instructions de normalisation à injecter dans chaque prompt IA
const NORMALIZATION_INSTRUCTIONS = `
NORMALISATION OBLIGATOIRE DU TEXTE (applique à chaque réplique) :
- Tous les chiffres en toutes lettres : "150" → "cent cinquante", "3,5" → "trois virgule cinq"
- Tous les acronymes avec phonétique entre parenthèses : "EISF" → "EISF (E.I.S.F.)", "HACCP" → "HACCP (Ha-A-Cé-Cé-Pé)"
- "%" → "pourcent", "€" → "euros", "°C" → "degrés Celsius", "&" → "et"
- text_studio = version avec phonétique pour la voix TTS (ex: "l'EISF (E.I.S.F.) forme cent cinquante apprentis")
- text_reading = version lisible sans parenthèses (ex: "l'EISF forme 150 apprentis")`;

module.exports = { router, normalizeText, NORMALIZATION_INSTRUCTIONS, ORAL_NATURALNESS_INSTRUCTIONS, verifyScriptAgainstSource };
