const { Pool } = require('pg');

let pool;

if (process.env.USE_MOCK_DB === 'true') {
  console.log('⚠️ [Database] Using Mock Database (In-Memory)');
  pool = require('./db_mock');
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  // Force chaque connexion à interpréter les timestamps en UTC
  // (évite le décalage de 2h quand Node.js tourne avec TZ=Europe/Paris)
  pool.on('connect', (client) => {
    client.query("SET timezone = 'UTC'");
  });
}

module.exports = pool;
