// Appel centralisé vers n8n → ChatGPT
// URL configurée via N8N_WEBHOOK_URL dans .env
async function callGPT(systemPrompt, userPrompt) {
    const url = process.env.N8N_WEBHOOK_URL;
    if (!url) throw new Error('N8N_WEBHOOK_URL non définie dans .env');

    const prompt = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
        throw new Error(`n8n a répondu ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const text = data.output?.[0]?.content?.[0]?.text
        || data.message?.content
        || data.text
        || JSON.stringify(data);

    return text.replace(/```json\n?|```/g, '').trim();
}

module.exports = callGPT;
