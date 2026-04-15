require('dotenv').config({ path: __dirname + '/.env' });
const pool = require('./models/db');
pool.query("SELECT id, project_id, title FROM podcasts ORDER BY id DESC LIMIT 20;")
.then(res => {
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
