// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const fs = require('fs');

// L'API Gemini TTS renvoie du PCM brut (24kHz, 16-bit, mono).
// On ajoute l'entête WAV pour produire un fichier .wav lisible.
function pcmToWav(pcmBuffer, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

const ALLOWED_VOICES = new Set(['Kore', 'Charon', 'Fenrir', 'Orus', 'Sadaltager', 'Aoede', 'Puck', 'Zephyr']);

async function generateAudio(dialogues, outputPath, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante');

  const voiceInes    = ALLOWED_VOICES.has(options.voiceInes)    ? options.voiceInes    : 'Kore';
  const voiceYannick = ALLOWED_VOICES.has(options.voiceYannick) ? options.voiceYannick : 'Charon';
  const speed        = options.speed;

  const speedInstruction =
    speed === 0.9 ? "Speak slowly and clearly. Take extra time on key concepts. Long natural pauses between sentences.\n\n" :
    speed === 1.1 ? "Speak at a lively, confident educational pace. Keep energy high. Brief natural pauses.\n\n" :
                    "Speak at a calm, measured educational pace. Take time on key concepts. Natural pauses between sentences.\n\n";

  const script = speedInstruction + dialogues
    .sort((a, b) => a.order_index - b.order_index)
    .map(d => {
      const speaker = d.character === 'ines' ? 'Inès' : 'Yannick';
      // Supprimer les balises [PROPOSITION:...] et les tags expressifs pour le TTS
      const text = (d.text_studio || d.text_reading || '')
        .replace(/\[PROPOSITION:[^\]]*\]/g, '')
        .replace(/\[vocal smile\]|\[newscaster\]|\[empathetic\]|\[laughs\]/gi, '')
        .trim();
      return `${speaker}: ${text}`;
    })
    .filter(line => line.split(': ')[1]?.length > 0)
    .join('\n');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: script }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: 'Inès',    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceInes    } } },
                { speaker: 'Yannick', voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceYannick } } }
              ]
            }
          }
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini TTS a répondu ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioBase64) throw new Error('Gemini TTS : aucune donnée audio dans la réponse');

  const pcm = Buffer.from(audioBase64, 'base64');
  const wav = pcmToWav(pcm);
  fs.writeFileSync(outputPath, wav);
  return outputPath;
}

module.exports = { generateAudio };
