require('dotenv').config({ path: __dirname + '/.env' });
const pool = require('./models/db');
(async () => {
    try {
        const projectId = 12; // Test with project 12 since I know it exists and has podcasts
        const podcasts = await pool.query(
            'SELECT * FROM podcasts WHERE project_id = $1 ORDER BY order_index ASC',
            [projectId]
        );
        console.log("Podcasts:", JSON.stringify(podcasts.rows, null, 2));

        const dialogues = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id IN (SELECT id FROM podcasts WHERE project_id = $1)',
            [projectId] // To check if they have dialogues
        );
        console.log("Dialogues:", JSON.stringify(dialogues.rows, null, 2));
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
