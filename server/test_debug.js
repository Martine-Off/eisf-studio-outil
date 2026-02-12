const http = require('http');

// Configuration
const HOST = '127.0.0.1';
const PORT = 3001;
const EMAIL = 'test_debug@example.com';
const PASSWORD = 'password123';

// Helper function for HTTP requests
function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                let parsed;
                try {
                    parsed = data ? JSON.parse(data) : {};
                } catch (e) {
                    parsed = data;
                }
                resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTest() {
    console.log('🚀 Starting Backend Verification Test...');

    try {
        // 1. Check Health
        console.log('\nScanning Server Health...');
        const health = await request('GET', '/health');
        if (health.statusCode !== 200) {
            console.error('❌ Server seems down or unhealthy:', health.statusCode);
            console.error('Response:', health.data);
            process.exit(1);
        }
        console.log('✅ Server is UP');

        // 2. Register/Login
        console.log('\nAttempting Authentication...');
        let auth = await request('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });

        if (auth.statusCode === 401) {
            console.log('⚠️ User not found, registering new user...');
            auth = await request('POST', '/api/auth/register', {
                email: EMAIL,
                password: PASSWORD,
                first_name: 'Debug',
                last_name: 'User'
            });
        }

        if (auth.statusCode !== 200 && auth.statusCode !== 201) {
            console.error('❌ Authentication Failed:', auth.statusCode, auth.data);
            process.exit(1);
        }

        const token = auth.data.token;
        if (!token) {
            console.error('❌ No token received!');
            process.exit(1);
        }
        console.log('✅ Authentication Successful. Token received.');

        // 3. Test Generate Route
        console.log('\nTesting Protected Route (/api/ai/generate-from-project)...');
        // Using a dummy project ID - expected result is 404 (Project not found) BUT NOT 401 (Unauthorized)
        const generate = await request('POST', '/api/ai/generate-from-project',
            { projectId: 999999, targetDuration: 5 },
            { 'Authorization': `Bearer ${token}` }
        );

        console.log(`Response Status: ${generate.statusCode}`);

        if (generate.statusCode === 401) {
            console.error('❌ FAILED: Received 401 Unauthorized even with valid token.');
            console.error('Server requires investigation of JWT_SECRET or Middleware.');
        } else if (generate.statusCode === 404) {
            // 404 is actually GOOD here because it implies 401 (Auth) was passed
            console.log('✅ SUCCESS: Received 404 (Project Not Found).');
            console.log('This confirms authentication passed and route is accessible!');
        } else if (generate.statusCode === 200) {
            console.log('✅ SUCCESS: Request processed successfully.');
        } else {
            console.log('⚠️ Unexpected status:', generate.statusCode);
            console.log('Response:', generate.data);
        }

    } catch (error) {
        console.error('❌ unexpected error:', error);
    }
}

runTest();
