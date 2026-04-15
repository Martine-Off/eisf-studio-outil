const pool = require('./models/db');
pool.query("SELECT id, title FROM projects LIMIT 1").then(res => {
    console.log(res.rows);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
