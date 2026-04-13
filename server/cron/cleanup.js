const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../models/db');

async function runCleanup() {
    console.log('🧹 [CLEANUP] Démarrage du job de nettoyage des fichiers inactifs...');

    try {
        if (process.env.USE_MOCK_DB === 'true') {
            console.log('⚠️ [CLEANUP] Mode Mock activé - Simulation uniquement.');
            console.log(' -> 3 fichiers identifiés pour archivage (> 30 jours)');
            console.log(' -> 1 fichier "source_file.docx" supprimé définitivement (> 120 jours)');
            return;
        }

        // 1. Trouver les projets inactifs depuis plus de 120 jours averc un fichier source
        // On utilise la date du jour moins 120 jours
        const query = `
            SELECT id, title, source_file_path 
            FROM projects 
            WHERE 
                (last_opened_at < NOW() - INTERVAL '120 days' OR (last_opened_at IS NULL AND updated_at < NOW() - INTERVAL '120 days'))
                AND source_file_path IS NOT NULL
        `;
        
        const result = await pool.query(query);
        console.log(`[CLEANUP] ${result.rows.length} projet(s) identifié(s) inactif(s) depuis plus de 120 jours.`);

        let deletedCount = 0;

        for (const project of result.rows) {
            console.log(`- Traitement du projet [${project.id}] "${project.title}"...`);
            
            if (fs.existsSync(project.source_file_path)) {
                try {
                    fs.unlinkSync(project.source_file_path);
                    console.log(`  🗑️ Fichier supprimé du disque : ${project.source_file_path}`);
                } catch (err) {
                    console.error(`  ❌ Erreur lors de la suppression de ${project.source_file_path}:`, err.message);
                    continue; // Skip DB update if file deletion failed
                }
            } else {
                console.log(`  ⚠️ Fichier introuvable sur le disque (déjà supprimé ?) : ${project.source_file_path}`);
            }

            // Mettre à jour la base de données
            await pool.query('UPDATE projects SET source_file_path = NULL WHERE id = $1', [project.id]);
            deletedCount++;
        }

        console.log(`✅ [CLEANUP] Terminé. ${deletedCount} fichiers source supprimés définitivement.`);

    } catch (error) {
        console.error('❌ [CLEANUP] Erreur critique:', error);
    } finally {
        process.exit(0);
    }
}

// Lancer le script
runCleanup();
