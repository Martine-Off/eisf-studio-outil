require('dotenv').config({ path: __dirname + '/.env' });
const pool = require('./models/db');
pool.query("SELECT podcast_id, SUM(LENGTH(COALESCE(text_reading, text_studio))) as total_length FROM dialogues GROUP BY podcast_id;")
.then(res => {
    console.log(res.rows);
    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
