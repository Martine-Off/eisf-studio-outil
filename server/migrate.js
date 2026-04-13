const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        console.log("Adding cleaned_text to projects...");
        await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS cleaned_text TEXT;');
        
        // On profite pour s'assurer que fidelity_score est dans podcasts
        console.log("Adding fidelity_score to podcasts...");
        await pool.query('ALTER TABLE podcasts ADD COLUMN IF NOT EXISTS fidelity_score DECIMAL(5,2);');
        
        console.log("Success!");
    } catch (e) {
        console.error("Error:", e);
    } finally {
        pool.end();
    }
}
run();
