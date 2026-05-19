const mammoth = require('mammoth');

// ─── Nettoyage HTML ───────────────────────────────────────────────────────────
function stripHtml(str) {
    return str
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&nbsp;|&#160;/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

// Retire les numéros de liste Storyline collés en début de texte (ex: "1L'homme" → "L'homme")
function cleanLine(text) {
    return text.replace(/^\d+([A-ZÀ-Üa-zà-ü•·\-\s(«"'])/g, '$1').trim();
}

const SKIP_CONTENT = /^(commencer|suivant|précédent|retour|continuer|fermer|replay|cliquez|sommaire|quiz|durée\s*:|agrandir|zoom|\d+\s*[-–]\s*$)/i;
const SKIP_TYPE_STATE = /état\s+(normal|survol)/i;

function isUseful(text) {
    if (!text || text.length < 12) return false;
    if (SKIP_CONTENT.test(text)) return false;
    if (/^[\d\s\-–•·%°/]+$/.test(text)) return false;      // que chiffres/symboles
    if (/^[a-zA-Z0-9_+/\-]{12,}$/.test(text)) return false; // IDs Storyline
    return true;
}

// ─── Parser principal ─────────────────────────────────────────────────────────
function parseStorylineHtml(html) {
    // Extraire toutes les lignes de tableau <tr>
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const rows = [];
    let trM;
    while ((trM = trRe.exec(html)) !== null) {
        const cells = [];
        tdRe.lastIndex = 0;
        let tdM;
        while ((tdM = tdRe.exec(trM[1])) !== null) {
            cells.push(stripHtml(tdM[1]));
        }
        if (cells.length >= 2) rows.push(cells);
    }

    const chapters = [];
    let currentTitle = null;
    let currentLines = [];
    let seenLines = new Set(); // dédoublonnage

    for (const cells of rows) {
        const type    = (cells[1] || '').trim();
        // Prendre Texte d'origine (col 2) ; si vide (ligne de continuation), prendre col 3
        const content = (cells[2] || cells[3] || '').trim();
        const typeL   = type.toLowerCase();

        // ── Limite de chapitre (Nom de la scène) ─────────────────────────────
        if (typeL === 'nom de la scène') {
            const name = content.trim();
            const isNavScene = !name || /^(EISF|homepage|introduction|quiz)/i.test(name);

            if (isNavScene) {
                // Scène de navigation : flush et désactiver
                if (currentTitle && currentLines.length > 0) {
                    chapters.push({ title: currentTitle, lines: [...currentLines] });
                }
                currentTitle = null;
            } else if (name !== currentTitle) {
                // Nouvelle scène pédagogique : flush + démarrer
                if (currentTitle && currentLines.length > 0) {
                    chapters.push({ title: currentTitle, lines: [...currentLines] });
                }
                currentTitle = name;
                currentLines = [];
                seenLines = new Set();
                // Si même scène répétée (nouvelle diapositive) : on continue d'accumuler
            }
            continue;
        }

        if (!currentTitle) continue;

        // ── Types à ignorer ───────────────────────────────────────────────────
        if (typeL === 'nom de la diapositive') continue;
        if (typeL === 'type' || typeL === 'id') continue; // ligne d'en-tête du tableau
        if (SKIP_TYPE_STATE.test(type)) continue;

        // Seuls les "Zone de texte" et certains "Rectangle" contiennent du contenu pédagogique
        const isZone = typeL.startsWith('zone de texte');
        const isContinuation = !type && content; // ligne de continuation (Type vide)
        if (!isZone && !isContinuation) continue;

        // ── Nettoyage et dédoublonnage ────────────────────────────────────────
        // Le contenu peut être multi-lignes (Storyline sépare paragraphes en lignes)
        const subLines = content.split('\n').map(l => cleanLine(l.trim())).filter(Boolean);
        for (const sub of subLines) {
            if (!isUseful(sub)) continue;
            const key = sub.toLowerCase();
            if (seenLines.has(key)) continue;
            seenLines.add(key);
            currentLines.push(sub);
        }
    }

    if (currentTitle && currentLines.length > 0) {
        chapters.push({ title: currentTitle, lines: [...currentLines] });
    }

    // ── Construire les objets chapitre + le Markdown final ───────────────────
    const chapterObjects = chapters.map(ch => {
        // Détecter un titre significatif : première ligne courte sans ponctuation finale
        let meaningfulTitle = ch.title;
        const lines = [...ch.lines];
        if (lines.length > 0) {
            const firstLine = lines[0];
            const wordCount = firstLine.split(/\s+/).length;
            const isTitleLike = firstLine.length <= 80 && wordCount <= 12
                && !firstLine.endsWith('.') && !firstLine.endsWith(',') && !firstLine.endsWith(';');
            if (isTitleLike) {
                meaningfulTitle = firstLine;
                lines.shift();
            }
        }
        const content = lines.join('\n');
        const wc = content.split(/\s+/).filter(w => w).length;
        return {
            title: meaningfulTitle,
            content,
            wordCount: wc,
            estimatedMinutes: Math.round((wc * 1.2) / 130),
            thematic_note: `Chapitre : ${meaningfulTitle}`
        };
    });

    // ── Fusion des chapitres < 350 mots avec le(s) suivant(s) jusqu'au seuil ──
    const balanced = [];
    let i = 0;
    while (i < chapterObjects.length) {
        const ch = { ...chapterObjects[i] };
        // Continuer à fusionner tant que trop court ET qu'il reste un chapitre suivant
        while (ch.wordCount < 600 && i + 1 < chapterObjects.length) {
            i++;
            const next = chapterObjects[i];
            const mergedContent = ch.content + '\n\n' + next.content;
            const mergedWc = mergedContent.split(/\s+/).filter(w => w).length;
            ch.title = ch.title + ' / ' + next.title;
            ch.content = mergedContent;
            ch.wordCount = mergedWc;
            ch.estimatedMinutes = Math.round((mergedWc * 1.2) / 130);
            ch.thematic_note = `Chapitre : ${ch.title}`;
        }
        balanced.push(ch);
        i++;
    }

    const markdown = balanced
        .map(ch => `## ${ch.title}\n\n${ch.content}`)
        .join('\n\n---\n\n');

    return { chapters: balanced, markdown };
}

// ─── Point d'entrée principal ─────────────────────────────────────────────────
async function parseStorylineFile(filePath) {
    const htmlResult = await mammoth.convertToHtml({ path: filePath });
    return parseStorylineHtml(htmlResult.value);
}

module.exports = { parseStorylineFile, parseStorylineHtml };
