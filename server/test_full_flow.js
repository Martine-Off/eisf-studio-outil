/**
 * Test complet du flux de génération
 * Teste : login → projets → generate-from-project
 */
require('dotenv').config();
const http = require('http');

function httpRequest(method, path, data, token) {
    return new Promise((resolve, reject) => {
        const body = data ? JSON.stringify(data) : null;
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (body) headers['Content-Length'] = Buffer.byteLength(body);

        const opts = { hostname: 'localhost', port: 3001, path, method, headers };
        const req = http.request(opts, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(raw); } catch { parsed = raw; }
                resolve({ status: res.statusCode, data: parsed, raw });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    console.log('=== TEST COMPLET DU FLUX DE GÉNÉRATION ===\n');

    // 1. VÉRIFIER LA CLÉ GEMINI
    console.log('1. Vérification clé Gemini...');
    const key = process.env.GEMINI_API_KEY;
    console.log('   GEMINI_API_KEY définie :', !!key);
    console.log('   Longueur clé :', key?.length || 0);
    console.log('   Début clé :', key?.substring(0, 10) + '...');

    // 2. TEST DIRECT GEMINI (sans passer par le serveur)
    console.log('\n2. Test direct Gemini API (tentative modèles multiples)...');

    const modelsToTry = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];
    let workingModel = null;

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(key);

    for (const modelName of modelsToTry) {
        console.log(`   👉 Essai avec ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig: { responseMimeType: 'application/json' }
            });
            const result = await model.generateContent('Reponds JSON: {"test": "ok"}');
            const text = result.response.text();
            console.log(`   ✅ SUCCÈS avec ${modelName} !`);
            console.log('   Réponse :', text.substring(0, 50));
            workingModel = modelName;
            break;
        } catch (e) {
            console.error(`   ❌ Échec ${modelName} :`, e.message);
            if (e.message.includes('429') || e.message.includes('retry')) {
                console.log('   ⏰ Rate limit...');
                await new Promise(r => setTimeout(r, 10000)); // Attendre 10s
            }
        }
    }

    if (!workingModel) {
        console.log('\n   STOP: Aucun modèle ne fonctionne. Vérifiez clé/crédits/rate-limit.');
        return;
    }
    console.log(`\n   ✅ Modèle validé : ${workingModel}`);

    // 3. HEALTH CHECK
    console.log('\n3. Health check serveur...');
    try {
        const health = await httpRequest('GET', '/health');
        console.log('   Status :', health.status);
        console.log('   DB :', health.data.database);
    } catch (e) {
        console.error('   ❌ Serveur non accessible :', e.message);
        return;
    }

    // 4. REGISTER / LOGIN
    console.log('\n4. Tentative inscription + login...');
    const creds = { email: 'testbot@eisf.fr', password: 'TestBot123!' };

    // Register first (ignore errors if already exists)
    const reg = await httpRequest('POST', '/api/auth/register', {
        ...creds,
        name: 'Test Bot'
    });
    console.log('   Register status :', reg.status, reg.status === 200 ? '(nouveau)' : '(existe déjà?)');

    // Login
    const login = await httpRequest('POST', '/api/auth/login', creds);
    console.log('   Login status :', login.status);

    if (login.status !== 200) {
        console.error('   ❌ Login échoué :', JSON.stringify(login.data));
        return;
    }

    const token = login.data.token;
    console.log('   ✅ Token obtenu');

    // 5. LISTER PROJETS
    console.log('\n5. Liste des projets...');
    const projects = await httpRequest('GET', '/api/projects', null, token);
    console.log('   Status :', projects.status);
    console.log('   Nombre projets :', Array.isArray(projects.data) ? projects.data.length : 'N/A');

    if (!Array.isArray(projects.data) || projects.data.length === 0) {
        console.log('   ⚠️ Aucun projet trouvé pour cet utilisateur.');
        console.log('   Essai avec les projets de la BDD...');

        // Tenter avec le pool directement
        const pool = require('./models/db');
        const allProjects = await pool.query('SELECT id, title, source_file_path, user_id FROM projects LIMIT 5');
        console.log('   Projets en BDD :', allProjects.rows.length);
        allProjects.rows.forEach(p => {
            console.log(`   - ID:${p.id} Title:"${p.title}" User:${p.user_id} File:${p.source_file_path}`);
        });

        if (allProjects.rows.length === 0) {
            console.log('\n   ❌ AUCUN PROJET dans la BDD. Il faut d\'abord importer un fichier Word.');
            return;
        }

        // On prend le premier projet et on vérifie que le fichier existe
        const proj = allProjects.rows[0];
        const fs = require('fs');
        console.log(`\n   Test fichier source : ${proj.source_file_path}`);
        console.log('   Fichier existe :', fs.existsSync(proj.source_file_path));

        console.log('\n   ❌ Le projet appartient à un autre utilisateur (user_id:', proj.user_id, ')');
        console.log('   Le bot de test n\'a pas accès à ce projet.');
        console.log('\n   → Tentative de génération malgré tout (pour voir l\'erreur exacte)...');

        const gen = await httpRequest('POST', '/api/ai/generate-from-project', {
            projectId: proj.id,
            targetDuration: 3
        }, token);

        console.log('\n6. Résultat génération :');
        console.log('   Status :', gen.status);
        console.log('   Réponse :', JSON.stringify(gen.data).substring(0, 500));
        return;
    }

    const proj = projects.data[0];
    console.log('   Projet choisi :', proj.id, '-', proj.title);

    // 6. GÉNÉRER
    console.log('\n6. Appel /api/ai/generate-from-project...');
    console.log('   projectId :', proj.id);
    console.log('   targetDuration : 3');

    const gen = await httpRequest('POST', '/api/ai/generate-from-project', {
        projectId: proj.id,
        targetDuration: 3
    }, token);

    console.log('\n   === RÉSULTAT ===');
    console.log('   Status :', gen.status);
    console.log('   Réponse :', JSON.stringify(gen.data).substring(0, 500));

    if (gen.status === 200) {
        console.log('\n   🎉 GÉNÉRATION RÉUSSIE !');
        console.log('   Podcast ID :', gen.data.podcastId);
        console.log('   Titre :', gen.data.title);
        console.log('   Mots :', gen.data.wordCount);
        console.log('   Dialogues :', gen.data.dialogueCount);
    } else {
        console.log('\n   ❌ GÉNÉRATION ÉCHOUÉE');
        console.log('   Erreur complète :', JSON.stringify(gen.data, null, 2));
    }
}

main().catch(e => console.error('ERREUR FATALE:', e));
