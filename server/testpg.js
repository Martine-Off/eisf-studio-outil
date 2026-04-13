const { Pool } = require('pg');
require('dotenv').config();
const p = new Pool({connectionString: process.env.DATABASE_URL});
p.query('INSERT INTO projects (user_id, title, source_file_path, cleaned_text) VALUES ($1, $2, $3, $4) RETURNING id', [1, 'Test', 'fakepath', 'fake text'])
.then(r => console.log('DB SUCCESS:', r.rows))
.catch(e => console.error('DB ERROR:', e))
.finally(() => p.end());
