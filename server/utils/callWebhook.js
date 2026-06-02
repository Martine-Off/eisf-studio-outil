// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
// Appel centralisé vers Make — toute la génération et vérification IA
// MAKE_WEBHOOK_URL absent → retourne null (fonctionnalités IA désactivées)
async function callWebhook(payload, timeoutMs = 60_000) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) {
    console.warn('[callWebhook] MAKE_WEBHOOK_URL absente → génération indisponible');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  console.log(`[callWebhook] type=${payload.type} | keys=${Object.keys(payload).join(', ')} | sourceText length=${payload.sourceText ? payload.sourceText.length : 'n/a'}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (response.status === 429) {
      const err = new Error('quota_make_exceeded');
      err.code = 'MAKE_QUOTA_EXCEEDED';
      err.status = 429;
      throw err;
    }

    if (!response.ok) {
      throw new Error(`Make webhook a répondu ${response.status}: ${await response.text()}`);
    }

    let text = await response.text();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    text = text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    console.log(`[callWebhook] Resp brute type=${payload.type} (${text.length} car.): ${text.substring(0,400)}`);
    try {
      return JSON.parse(text);
    } catch {
      console.warn(`[callWebhook] Reponse non-JSON pour type=${payload.type}, retour brut`);
      return text;
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`Make n'a pas répondu dans le délai imparti (${[Math.round(timeoutMs / 1000)]}s)`);
      timeoutErr.code = 'MAKE_TIMEOUT';
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = { callWebhook };