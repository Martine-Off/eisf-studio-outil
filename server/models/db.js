// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
const { Pool, types } = require('pg');

// OID 1114 = timestamp without time zone
// node-postgres lit ces valeurs sans suffixe timezone, donc new Date('2026-05-18T15:12:41')
// est interprété avec process.env.TZ ('Europe/Paris') → décalage de 2h.
// Ce parser force l'interprétation UTC en ajoutant 'Z' avant le parsing.
types.setTypeParser(1114, (str) => new Date(str + 'Z'));

let pool;

if (process.env.USE_MOCK_DB === 'true') {
  console.log('⚠️ [Database] Using Mock Database (In-Memory)');
  pool = require('./db_mock');
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  pool.on('connect', (client) => {
    client.query("SET timezone = 'UTC'");
  });
}

module.exports = pool;
