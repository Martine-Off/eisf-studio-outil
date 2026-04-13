const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
    try {
        fs.writeFileSync('dummy.docx', 'PK\x03\x04\x14\x00\x00\x00\x08\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00');
        
        const form = new FormData();
        form.append('file', fs.createReadStream('dummy.docx'));
        form.append('title', 'Test API Upload');
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { userId: 1, email: 'admin@eisf.fr' },
            'votre_secret_super_securise_changez_moi',
            { expiresIn: '7d' }
        );

        const response = await fetch('http://localhost:3001/api/projects/create', {
            method: 'POST',
            body: form,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        console.log("Response:", data);
    } catch (error) {
        console.error("Request Error:", error);
    }
}
testUpload();
