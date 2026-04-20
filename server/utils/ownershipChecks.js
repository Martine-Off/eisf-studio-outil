/**
 * Utilitaires de vérification de propriété des ressources.
 * Toutes les fonctions lèvent une erreur 403 si l'utilisateur
 * ne possède pas la ressource demandée.
 */
const pool = require('../models/db');

/**
 * Vérifie que le projet appartient à l'utilisateur.
 * @returns {object} La ligne projet si OK
 * @throws {Error} code 403 si non autorisé, 404 si introuvable
 */
async function assertProjectOwner(projectId, userId) {
    const result = await pool.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
    );
    if (result.rows.length === 0) {
        const err = new Error('Projet introuvable ou accès refusé');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

/**
 * Vérifie que le podcast appartient à l'utilisateur (via son projet).
 * @returns {object} { id: podcastId, project_id }
 * @throws {Error} code 404 si introuvable / non autorisé
 */
async function assertPodcastOwner(podcastId, userId) {
    const result = await pool.query(
        `SELECT podcasts.id, podcasts.project_id
         FROM podcasts
         JOIN projects ON podcasts.project_id = projects.id
         WHERE podcasts.id = $1 AND projects.user_id = $2`,
        [podcastId, userId]
    );
    if (result.rows.length === 0) {
        const err = new Error('Podcast introuvable ou accès refusé');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

/**
 * Vérifie que le dialogue appartient à l'utilisateur (via podcast → projet).
 * @returns {object} { id: dialogueId, podcast_id, project_id }
 * @throws {Error} code 404 si introuvable / non autorisé
 */
async function assertDialogueOwner(dialogueId, userId) {
    const result = await pool.query(
        `SELECT dialogues.id, dialogues.podcast_id, projects.id AS project_id
         FROM dialogues
         JOIN podcasts ON dialogues.podcast_id = podcasts.id
         JOIN projects ON podcasts.project_id = projects.id
         WHERE dialogues.id = $1 AND projects.user_id = $2`,
        [dialogueId, userId]
    );
    if (result.rows.length === 0) {
        const err = new Error('Dialogue introuvable ou accès refusé');
        err.statusCode = 404;
        throw err;
    }
    return result.rows[0];
}

/**
 * Middleware générique : envoie la réponse d'erreur appropriée.
 */
function handleOwnershipError(res, err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message });
}

module.exports = { assertProjectOwner, assertPodcastOwner, assertDialogueOwner, handleOwnershipError };
