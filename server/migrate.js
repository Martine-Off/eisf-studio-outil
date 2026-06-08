/**
 * Studio EISF — Plateforme de génération de podcasts pédagogiques
 *
 * © 2026 EISF — École Internationale du Savoir-Faire Français
 * Tous droits réservés / All Rights Reserved.
 *
 * @author  Martine Desmaroux <contact@eisf.fr>
 * @license Propriétaire — EISF
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        console.log("Adding cleaned_text to projects...");
        await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS cleaned_text TEXT;');

        console.log("Adding fidelity_score to podcasts...");
        await pool.query('ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS fidelity_score DECIMAL(5,2);');

        console.log("Adding ia_feedback to podcasts...");
        await pool.query('ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS ia_feedback JSONB;');

        console.log("Adding audio_url to podcasts...");
        await pool.query('ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS audio_url VARCHAR(500);');

        console.log("Adding macro_score to projects...");
        await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS macro_score INTEGER;');

        console.log("Adding macro_feedback to projects...");
        await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS macro_feedback JSONB;');

        console.log("Adding updated_at to podcasts...");
        await pool.query('ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();');

        console.log("Creating updated_at trigger for podcasts...");
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        await pool.query(`
            DROP TRIGGER IF EXISTS update_podcasts_updated_at ON podcasts;
            CREATE TRIGGER update_podcasts_updated_at
              BEFORE UPDATE ON podcasts
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column();
        `);

        console.log("Creating updated_at trigger for projects...");
        await pool.query(`
            DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
            CREATE TRIGGER update_projects_updated_at
              BEFORE UPDATE ON projects
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column();
        `);

        console.log("Adding sound_before to dialogues...");
        await pool.query('ALTER TABLE dialogues ADD COLUMN IF NOT EXISTS sound_before BOOLEAN DEFAULT false;');

        console.log("All migrations OK!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
run();
