const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'https://miespacio.blog';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

async function apiRequest(url, options = {}) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (_err) {
            data = { raw: text };
        }
    }
    if (!res.ok) {
        const msg = (data && (data.error || data.message || data.raw)) || `HTTP ${res.status}`;
        throw new Error(`${url} -> ${msg}`);
    }
    return data;
}

async function main() {
    const loginPayload = await apiRequest(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS })
    });
    if (!loginPayload?.token) {
        throw new Error('No se obtuvo token en login de administrador.');
    }
    const token = loginPayload.token;
    const headers = { Authorization: `Bearer ${token}` };

    const [me, categories, tools] = await Promise.all([
        apiRequest(`${BASE_URL}/api/auth/me`, { headers }),
        apiRequest(`${BASE_URL}/api/categories`, { headers }),
        apiRequest(`${BASE_URL}/api/tools`, { headers })
    ]);

    let adminUsers = null;
    let adminCategories = null;
    try {
        adminUsers = await apiRequest(`${BASE_URL}/api/admin/users`, { headers });
    } catch (_err) {
        adminUsers = { note: 'Endpoint no disponible en versión desplegada actual.' };
    }
    try {
        adminCategories = await apiRequest(`${BASE_URL}/api/admin/categories`, { headers });
    } catch (_err) {
        adminCategories = { note: 'Endpoint no disponible en versión desplegada actual.' };
    }

    const backup = {
        exportedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        authUser: me,
        categories,
        tools,
        adminUsers,
        adminCategories
    };

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const filename = `backup-production-${Date.now()}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf8');

    console.log(JSON.stringify({
        ok: true,
        file: filepath,
        totalCategories: Array.isArray(categories) ? categories.length : 0,
        totalTools: Array.isArray(tools) ? tools.length : 0
    }, null, 2));
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
