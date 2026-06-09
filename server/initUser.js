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

const p = new Pool({connectionString: process.env.DATABASE_URL});

async function run() {
  try {
    await p.query(
        "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, 'single-auth', 'Admin', '') ON CONFLICT (email) DO NOTHING",
        [process.env.APP_LOGIN]
    );
    await p.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
    console.log('Utilisateur initial créé :', process.env.APP_LOGIN);
  } catch(e) {
    console.error(e);
  } finally {
    p.end();
  }
}

run();
