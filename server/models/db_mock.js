// Copyright (c) 2026 EISF — École Internationale du Savoir Faire Français
// Tous droits réservés / All Rights Reserved
// Auteur : Martine Desmaroux — martine.desmaroux@gmail.com / contact@eisf.fr
//
/**
 * Mock Database for Studio EISF
 * Simulates PostgreSQL Pool for in-memory testing when Docker is unavailable.
 */

const mockStore = {
    users: [
        { id: 1, email: 'test@example.com', password_hash: '$2b$12$K7v...' /* 'password' hash */, first_name: 'Test', last_name: 'User' }
    ],
    projects: [],
    podcasts: [],
    dialogues: []
};

let nextIds = { users: 2, projects: 1, podcasts: 1, dialogues: 1 };

class MockPool {
    async query(queryString, params = []) {
        // Basic query parsing
        const text = queryString.toLowerCase().trim();

        // 1. SELECT users (Login)
        if (text.startsWith('select id, email, password_hash') && text.includes('from users where email = $1')) {
            const user = mockStore.users.find(u => u.email === params[0]);
            return { rows: user ? [user] : [] };
        }

        // 2. INSERT users (Register)
        if (text.startsWith('insert into users')) {
            const newUser = {
                id: nextIds.users++,
                email: params[0],
                password_hash: params[1],
                first_name: params[2],
                last_name: params[3],
                created_at: new Date()
            };
            mockStore.users.push(newUser);
            return { rows: [newUser] };
        }

        // 3. SELECT projects
        if (text.startsWith('select * from projects where user_id = $1')) {
            return { rows: mockStore.projects.filter(p => p.user_id === params[0]) };
        }

        // 4. INSERT projects
        if (text.startsWith('insert into projects')) {
            const newProject = {
                id: nextIds.projects++,
                user_id: params[0],
                title: params[1],
                source_file_path: params[2],
                status: 'draft',
                created_at: new Date(),
                updated_at: new Date()
            };
            mockStore.projects.push(newProject);
            return { rows: [newProject] };
        }

        // 4b. SELECT source_file_path FROM projects
        if (text.startsWith('select source_file_path from projects')) {
            const project = mockStore.projects.find(p => p.id == params[0]);
            return { rows: project ? [project] : [] };
        }

        // 4c. INSERT INTO podcasts
        if (text.startsWith('insert into podcasts')) {
            const newPodcast = {
                id: nextIds.podcasts++,
                project_id: params[0],
                title: params[1],
                word_count: params[2],
                duration_seconds: params[3],
                created_at: new Date()
            };
            mockStore.podcasts.push(newPodcast);
            return { rows: [newPodcast] };
        }

        // 4d. INSERT INTO dialogues
        if (text.startsWith('insert into dialogues')) {
            const newDialogue = {
                id: nextIds.dialogues++,
                podcast_id: params[0],
                order_index: params[1],
                character: params[2],
                text_studio: params[3],
                text_reading: params[4],
                duration_seconds: params[5],
                section: params[6]
            };
            mockStore.dialogues.push(newDialogue);
            return { rows: [newDialogue] };
        }

        // 4e. SELECT * FROM podcasts
        if (text.startsWith('select * from podcasts where project_id = $1')) {
            const podcasts = mockStore.podcasts
                .filter(p => p.project_id == params[0])
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            return { rows: podcasts };
        }

        // 4f. SELECT * FROM dialogues
        if (text.startsWith('select * from dialogues where podcast_id = $1')) {
            const dialogues = mockStore.dialogues
                .filter(d => d.podcast_id == params[0])
                .sort((a, b) => a.order_index - b.order_index);
            return { rows: dialogues };
        }

        // 5. UPDATE users, projects, ou dialogues
        if (text.startsWith('update users') || text.startsWith('update projects')) {
            return { rows: [], rowCount: 1 };
        }

        // 5b. UPDATE dialogues (Save & Reorder)
        if (text.startsWith('update dialogues set text_studio')) {
            const dialogue = mockStore.dialogues.find(d => d.id == params[1]);
            if (dialogue) {
                dialogue.text_studio = params[0];
            }
            return { rows: [], rowCount: 1 };
        }
        
        if (text.startsWith('update dialogues set order_index')) {
            const dialogue = mockStore.dialogues.find(d => d.id == params[1]);
            if (dialogue) {
                dialogue.order_index = params[0];
            }
            return { rows: [], rowCount: 1 };
        }

        // 6. Generic SELECT 1 (Health Check)
        if (text === 'select 1') {
            return { rows: [{ 1: 1 }] };
        }

        // 7. Generic SELECT * FROM table WHERE id = $1
        if (text.includes('select * from') && text.includes('where id = $1')) {
            const table = text.match(/from (\w+)/)[1];
            const items = mockStore[table] || [];
            const item = items.find(i => i.id == params[0]);
            return { rows: item ? [item] : [] };
        }

        // Fallback générique pour BEGIN/COMMIT/ROLLBACK
        if (['begin', 'commit', 'rollback'].includes(text)) {
            return { rows: [] };
        }

        console.warn(`[MockDB] Unhandled query: ${queryString}`);
        return { rows: [] };
    }

    async connect() {
        return {
            query: this.query.bind(this),
            release: () => { }
        };
    }
}

module.exports = new MockPool();
