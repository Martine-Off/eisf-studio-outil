// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
const { callWebhook } = require('./callWebhook');

function toTextString(result) {
  if (typeof result === 'string') return result;
  return result?.text || result?.output || JSON.stringify(result);
}

async function verifyScriptAgainstSource(segmentContent, scriptText, cachedConcepts = null, onConceptsExtracted = null) {
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
    if (onConceptsExtracted) await onConceptsExtracted(concepts);
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
  const validated  = lines.filter(l => l.toLowerCase().includes('present')).length;
  const uncertain  = lines.filter(l => l.toLowerCase().includes('uncertain')).length;
  const missing    = lines.filter(l => !l.toLowerCase().includes('present') && !l.toLowerCase().includes('uncertain'));
  const countable  = total - uncertain;
  const rawScore = countable > 0 ? Math.round((validated / countable) * 100) : 0;

  const allResults = lines.map(l => {
    const parts = l.split('|');
    const low = l.toLowerCase();
    const status = low.includes('present') ? 'present' : low.includes('uncertain') ? 'uncertain' : 'absent';
    return { concept: parts[0].trim(), status };
  });

  return {
    fidelityScore: rawScore,
    totalConcepts: total,
    validatedConcepts: validated,
    uncertainConcepts: uncertain,
    uncertainConceptsList: lines
      .filter(l => l.toLowerCase().includes('uncertain'))
      .map(l => l.split('|')[0].trim()),
    missingConcepts: missing.map(l => l.split('|')[0].trim()),
    extractedConcepts: concepts,
    allResults
  };
}

module.exports = { verifyScriptAgainstSource };
