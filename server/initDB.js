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
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        console.log("Connecting to DB on " + process.env.DATABASE_URL);
        const schema = fs.readFileSync(path.join(__dirname, 'models', 'schema.sql'), 'utf-8');
        
        console.log("Running complete schema.sql...");
        await pool.query(schema);
        
        console.log("Schema initialized successfully!");
    } catch (e) {
        console.error("Error formatting DB:", e);
    } finally {
        pool.end();
    }
}
run();
