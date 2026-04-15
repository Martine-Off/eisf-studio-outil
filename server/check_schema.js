require('dotenv').config({ path: __dirname + '/.env' });
const pool = require('./models/db');
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'podcasts';")
.then(res => {
    console.log(res.rows);
    process.exit(0);
})
.catch(err => {
    console.error(err);
    process.exit(1);
});
