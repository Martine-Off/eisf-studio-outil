// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const fs = require('fs');
const path = require('path');

const VOICE_CONFIG = {
    ines: {
        voiceId:          process.env.ELEVENLABS_VOICE_INES       || 'd3AXX0BlgJHYFCuH9X88',
        stability:        parseFloat(process.env.ELEVENLABS_STABILITY_INES)   || 0.82,
        similarity_boost: parseFloat(process.env.ELEVENLABS_SIMILARITY_INES)  || 0.90,
        style:            parseFloat(process.env.ELEVENLABS_STYLE_INES)       || 0.45,
        speed:            parseFloat(process.env.ELEVENLABS_SPEED_INES)       || 1.03,
    },
    yannick: {
        voiceId:          process.env.ELEVENLABS_VOICE_YANNICK       || 'jGpnMdbhtKgQbVrYezOx',
        stability:        parseFloat(process.env.ELEVENLABS_STABILITY_YANNICK)   || 0.45,
        similarity_boost: parseFloat(process.env.ELEVENLABS_SIMILARITY_YANNICK)  || 0.90,
        style:            parseFloat(process.env.ELEVENLABS_STYLE_YANNICK)       || 0.35,
        speed:            parseFloat(process.env.ELEVENLABS_SPEED_YANNICK)       || 1.10,
    },
};

async function generateDialogueMp3(text, character, podcastId, dialogueId, previousText = null, nextText = null) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY manquante');

    const config = VOICE_CONFIG[character] || VOICE_CONFIG.ines;

    const dir = path.join(__dirname, '../audio', String(podcastId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const outputPath = path.join(dir, `${dialogueId}.mp3`);

    const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
        {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                ...(previousText && { previous_text: previousText }),
                ...(nextText     && { next_text:      nextText }),
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability:         config.stability,
                    similarity_boost:  config.similarity_boost,
                    style:             config.style,
                    speed:             config.speed,
                    use_speaker_boost: true,
                },
            }),
        }
    );

    if (response.status === 429) {
        const err = new Error('quota_elevenlabs_exceeded');
        err.code = 'ELEVENLABS_QUOTA_EXCEEDED';
        err.status = 429;
        throw err;
    }
    if (!response.ok) {
        throw new Error(`ElevenLabs a répondu ${response.status}: ${await response.text()}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return outputPath;
}

module.exports = { generateDialogueMp3, VOICE_CONFIG };
