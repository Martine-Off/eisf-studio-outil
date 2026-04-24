// Appel direct Express → Mistral — utilisé pour vérification de fidélité
// MISTRAL_API_KEY absent → mock (vérification désactivée, score 0)
async function callMistral(systemPrompt, userPrompt, model = 'mistral-small-latest') {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.warn('[callMistral] MISTRAL_API_KEY absente → mode mock');
    return '[MOCK] Réponse Mistral simulée';
  }

  const response = await fetch(
    'https://api.mistral.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Mistral a répondu ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

module.exports = { callMistral };
