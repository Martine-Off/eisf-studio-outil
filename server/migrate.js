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

        console.log("All migrations OK!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
run();
