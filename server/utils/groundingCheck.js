const pool = require('../models/db');
const { callWebhook } = require('./callWebhook');

async function groundingCheck(podcastId, segmentContent) {
  const result = await pool.query(
    'SELECT id, text_studio FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
    [podcastId]
  );
  const dialogues = result.rows;
  if (!dialogues.length) return;

  const groundingResult = await callWebhook({
    type: 'grounding-check',
    sourceText: segmentContent,
    dialogues: dialogues.map(d => ({ id: d.id, text: d.text_studio }))
  }, 120_000);

  if (!Array.isArray(groundingResult)) {
    console.warn('[groundingCheck] Réponse Make invalide:', groundingResult);
    return;
  }

  for (const { id, is_grounded } of groundingResult) {
    if (id == null) continue;
    const value = is_grounded === true ? true : is_grounded === false ? false : null;
    await pool.query(
      'UPDATE dialogues SET is_grounded = $1 WHERE id = $2 AND podcast_id = $3',
      [value, id, podcastId]
    );
  }
}

module.exports = { groundingCheck };
