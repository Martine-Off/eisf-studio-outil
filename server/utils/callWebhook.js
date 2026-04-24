// Appel centralisé vers Make (ex-n8n) — génération dialogue
// Le prompt est dans Make ; Express envoie uniquement les données brutes.
// MAKE_WEBHOOK_URL absent → mock (génération désactivée, acceptable en dev)
async function callWebhook(payload) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) {
    console.warn('[callWebhook] MAKE_WEBHOOK_URL absente → génération indisponible');
    return null;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Make webhook a répondu ${response.status}: ${await response.text()}`);
  }

  // ↓ CHANGEMENT : on lit en texte brut d'abord, plus en .json() directement
  const rawText = await response.text();

  // Cas 1 : réponse vide (Make a timeout silencieusement)
  if (!rawText || rawText.trim() === '') {
    console.warn('[callWebhook] Réponse vide de Make → timeout probable.');
    return null;
  }

  // Cas 2 : Make répond "Accepted" ou un texte simple (pas du JSON)
  if (!rawText.trim().startsWith('{') && !rawText.trim().startsWith('[')) {
    console.warn(`[callWebhook] Réponse non-JSON de Make : "${rawText.slice(0, 80)}"`);
    return null;
  }

  // Cas 3 : JSON potentiellement tronqué
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    console.error(`[callWebhook] JSON invalide reçu (${rawText.length} chars) : ${err.message}`);
    console.error(`[callWebhook] Début de la réponse : ${rawText.slice(0, 300)}`);
    return null;
  }

  // Extraction du texte — inchangée par rapport à avant
  const text = data.choices?.[0]?.message?.content
    || data.output?.[0]?.content?.[0]?.text
    || data.message?.content
    || data.text
    || (typeof data === 'string' ? data : JSON.stringify(data));

  return text.replace(/```json\n?|```/g, '').trim();
}

module.exports = { callWebhook };
