/**
 * Studio EISF — Plateforme de génération de podcasts pédagogiques
 *
 * © 2026 EISF — École Internationale du Savoir-Faire Français
 * Tous droits réservés / All Rights Reserved.
 *
 * @author  Martine Desmaroux <contact@eisf.fr>
 * @license Propriétaire — EISF
 */
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
require('dotenv').config();

const p = new Pool({connectionString: process.env.DATABASE_URL});

async function run() {
  try {
    const hash = await bcrypt.hash('admin', 12);
    await p.query(
        "INSERT INTO users (id, email, password_hash, first_name) VALUES (1, 'admin@eisf.fr', $1, 'Admin') ON CONFLICT (id) DO NOTHING",
        [hash]
    );
    // Restart identity sequence so future registrations won't collide with ID 1
    await p.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
    console.log('Mock user 1 created successfully to match your browser session!');
  } catch(e) {
    console.error(e);
  } finally {
    p.end();
  }
}

run();
