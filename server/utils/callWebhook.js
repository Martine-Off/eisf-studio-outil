// Appel centralisé vers Make — toute la génération et vérification IA
// MAKE_WEBHOOK_URL absent → retourne null (fonctionnalités IA désactivées)
async function callWebhook(payload) {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) {
    console.warn('[callWebhook] MAKE_WEBHOOK_URL absente → génération indisponible');
    return null;
  }

  console.log(`[callWebhook] → ${url}`);
  console.log(`[callWebhook] type=${payload.type} | keys=${Object.keys(payload).join(', ')} | sourceText length=${payload.sourceText ? payload.sourceText.length : 'n/a'}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Make webhook a répondu ${response.status}: ${await response.text()}`);
  }

  let text = await response.text()
  text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

module.exports = { callWebhook };
