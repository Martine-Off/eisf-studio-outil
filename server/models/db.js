const { Pool } = require('pg');

let pool;

if (process.env.USE_MOCK_DB === 'true') {
  console.log('⚠️ [Database] Using Mock Database (In-Memory)');
  pool = require('./db_mock');
} else {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
}

module.exports = pool;
