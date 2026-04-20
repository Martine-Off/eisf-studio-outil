const fetch = require('node-fetch');

async function testWebhook() {
    const prompt = "Génère un dialogue court en JSON au format { \"dialogues\": [{ \"id\": 1, \"text_studio\": \"Bonjour\", \"text_reading\": \"Bonjour\" }] }";
    try {
        const response = await fetch('http://localhost:5678/webhook/501bb061-982b-4b25-b782-d137b9ea8916', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
}

testWebhook();
