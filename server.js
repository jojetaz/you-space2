const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'cambia-este-secreto-en-produccion';
const VIP_CATEGORY = 'Herramientas Exclusivas VIP';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || '';
const IMPORT_LEGACY_SECRET = process.env.IMPORT_LEGACY_SECRET || '';
const LEGACY_BASE_URL = process.env.LEGACY_BASE_URL || 'https://you-space-app-1.onrender.com';
const LEGACY_CATEGORY_IDS = process.env.LEGACY_CATEGORY_IDS || '';
const STRIPE_CHECKOUT_MONTHLY_URL = process.env.STRIPE_CHECKOUT_MONTHLY_URL || '';
const STRIPE_CHECKOUT_YEARLY_URL = process.env.STRIPE_CHECKOUT_YEARLY_URL || '';
const PAYPAL_CHECKOUT_MONTHLY_URL = process.env.PAYPAL_CHECKOUT_MONTHLY_URL || '';
const PAYPAL_CHECKOUT_YEARLY_URL = process.env.PAYPAL_CHECKOUT_YEARLY_URL || '';

// En Render (plan Free), el disco del contenedor es efímero: cada deploy borra ./data.
// Monta un Persistent Disk y define DATA_DIR al punto de montaje (ej. /var/data).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'you-space.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new sqlite3.Database(DB_PATH);
const mpClient = MP_ACCESS_TOKEN ? new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN }) : null;

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function tableHasColumn(tableName, columnName) {
    const columns = await all(`PRAGMA table_info(${tableName})`);
    return columns.some((c) => c.name === columnName);
}

const defaultTools = [
    { categoria: 'Generación de Video e IA', nombre: 'tensor.art', descripcion: 'Generación de video (1 por día) e imagen (50 por día), sin censura', url: 'https://tensor.art', videoUrl: '', fecha: '23/06/2025', accessLevel: 'free' },
    { categoria: 'Generación de Video e IA', nombre: 'ltx estudio', descripcion: 'Imagen y video gratis', url: 'https://ltx.studio', videoUrl: '', fecha: '21/06/2025', accessLevel: 'free' },
    { categoria: 'Generación de Video e IA', nombre: 'seedance v1', descripcion: 'Mejor generador de video del momento junio 2025 gratis, texto o imagen a video', url: 'https://seedance.ai', videoUrl: '', fecha: '10/07/2025', accessLevel: 'free' },
    { categoria: 'Generación de Video e IA', nombre: 'seaart.ia', descripcion: 'Generación de videos e imagen sin censura', url: 'https://seaart.ai', videoUrl: '', fecha: '10/07/2025', accessLevel: 'free' },
    { categoria: VIP_CATEGORY, nombre: 'Novedades VIP', descripcion: 'Contenido premium para usuarios con suscripción activa.', url: 'https://example.com/vip', videoUrl: '', fecha: '25/04/2026', accessLevel: 'vip' }
];

const legacyCategoryMap = {
    'Generacion de video e imagen': 'Generación de Video e IA',
    'Generación de Imágenes': 'Diseño Gráfico',
    'Tips impresoras 3d': 'Impresoras 3D',
    'herramientas de reparacion': 'Herramientas de Reparación',
    'Presentaciones y analisis de datos': 'Presentaciones y Datos',
    'Crear paginas web y app': 'Crear Páginas Web',
    negocios: 'Ofertas y Viajes',
    'Generar imagen 3D': 'Imagen 3D',
    'Audio y musica': 'Audio y Edición',
    'Herramientas de busqueda': 'Recursos de IA',
    'Herramientas utiles variadas': 'Recursos de IA',
    'Renderizar y optimizar planos': 'Diseño Gráfico'
};

function normalizeLegacyCategory(name) {
    return legacyCategoryMap[name] || name;
}

function cleanLegacyHtml(text) {
    return String(text || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseLegacyCategoryPage(html) {
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    const category = titleMatch ? cleanLegacyHtml(titleMatch[1]) : '';
    if (!category || category.toLowerCase().includes('portafolio')) return null;

    const rows = [];
    const tableRows = html.match(/<tr>[\s\S]*?<\/tr>/gi) || [];
    for (const rowHtml of tableRows) {
        const cols = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
        if (cols.length < 5) continue;

        const nombre = cleanLegacyHtml(cols[0]);
        const descripcion = cleanLegacyHtml(cols[1]);
        const urlMatch = cols[2].match(/href=["']([^"']+)["']/i);
        const videoMatch = cols[3].match(/href=["']([^"']+)["']/i);
        const fecha = cleanLegacyHtml(cols[4]);
        if (!nombre || !urlMatch) continue;

        rows.push({
            categoria: normalizeLegacyCategory(category),
            nombre,
            descripcion: descripcion || 'Sin descripción',
            url: urlMatch[1],
            videoUrl: videoMatch ? videoMatch[1] : '',
            fecha: fecha || new Date().toLocaleDateString('es-CL')
        });
    }
    return rows;
}

async function importLegacyTools() {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    async function fetchWithRetry(url, attempts = 5) {
        let lastStatus = 0;
        for (let i = 0; i < attempts; i += 1) {
            const res = await fetch(url);
            if (res.ok) return res;
            lastStatus = res.status;
            if (res.status === 429 || res.status >= 500) {
                await wait(800 * (i + 1));
                continue;
            }
            return res;
        }
        throw new Error(`No se pudo leer recurso legacy (${lastStatus || 'sin respuesta'})`);
    }

    let ids = [];
    if (LEGACY_CATEGORY_IDS.trim()) {
        ids = Array.from(
            new Set(
                LEGACY_CATEGORY_IDS.split(',')
                    .map((v) => Number(v.trim()))
                    .filter((n) => Number.isInteger(n) && n > 0)
            )
        ).sort((a, b) => a - b);
    } else {
        const homeRes = await fetchWithRetry(`${LEGACY_BASE_URL}/`);
        const homeHtml = await homeRes.text();
        ids = Array.from(
            new Set((homeHtml.match(/\/categoria\/\d+/g) || []).map((m) => Number(m.split('/').pop())))
        )
            .filter((id) => Number.isInteger(id))
            .sort((a, b) => a - b);
    }
    if (ids.length === 0) throw new Error('No se detectaron categorías legacy para importar.');

    let fetchedCategories = 0;
    let totalRows = 0;
    let inserted = 0;
    let skipped = 0;
    const insertedByCategory = {};

    for (const id of ids) {
        const res = await fetchWithRetry(`${LEGACY_BASE_URL}/categoria/${id}`);
        if (!res.ok) continue;
        const html = await res.text();
        const rows = parseLegacyCategoryPage(html);
        if (!rows || rows.length === 0) continue;

        fetchedCategories += 1;
        totalRows += rows.length;

        for (const tool of rows) {
            const existing = await get(
                'SELECT id FROM tools WHERE categoria = ? AND nombre = ? AND url = ?',
                [tool.categoria, tool.nombre, tool.url]
            );
            if (existing) {
                skipped += 1;
                continue;
            }
            await run(
                'INSERT INTO tools (categoria, nombre, descripcion, url, video_url, fecha, access_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [tool.categoria, tool.nombre, tool.descripcion, tool.url, tool.videoUrl, tool.fecha, 'free']
            );
            inserted += 1;
            insertedByCategory[tool.categoria] = (insertedByCategory[tool.categoria] || 0) + 1;
        }
        await wait(250);
    }

    return { fetchedCategories, totalRows, inserted, skipped, insertedByCategory, ids };
}

async function getUserWithProfileByUsername(username) {
    return get(
        `SELECT u.id, u.username, u.password_hash, u.role, p.plan, p.vip_status
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.username = ?`,
        [username]
    );
}

async function getUserWithProfileById(id) {
    return get(
        `SELECT u.id, u.username, u.role, p.plan, p.vip_status
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
         WHERE u.id = ?`,
        [id]
    );
}

function isVipActive(user) {
    return !!user && (user.role === 'admin' || (user.plan === 'vip' && user.vip_status === 'active'));
}

function serializeUser(user) {
    return {
        id: String(user.id),
        username: user.username,
        role: user.role,
        plan: user.plan || 'free',
        vipStatus: user.vip_status || 'none',
        vipActive: isVipActive(user)
    };
}

async function initializeDatabase() {
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'usuario')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'vip')),
            vip_status TEXT NOT NULL DEFAULT 'none' CHECK (vip_status IN ('none', 'pending', 'active')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS tools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria TEXT NOT NULL,
            nombre TEXT NOT NULL,
            descripcion TEXT NOT NULL,
            url TEXT NOT NULL,
            video_url TEXT DEFAULT '',
            fecha TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    if (!(await tableHasColumn('tools', 'access_level'))) {
        await run(`ALTER TABLE tools ADD COLUMN access_level TEXT NOT NULL DEFAULT 'free' CHECK (access_level IN ('free', 'vip'))`);
    }

    await run(`
        CREATE TABLE IF NOT EXISTS forum_comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS subscription_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            external_reference TEXT NOT NULL UNIQUE,
            provider TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            amount REAL NOT NULL DEFAULT 0,
            currency TEXT NOT NULL DEFAULT 'USD',
            payment_id TEXT,
            raw_payload TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    const admin = await get('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!admin) {
        const hash = await bcrypt.hash('admin123', 10);
        const created = await run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
        await run('INSERT INTO user_profiles (user_id, plan, vip_status) VALUES (?, ?, ?)', [created.id, 'vip', 'active']);
    }

    const usuario = await get('SELECT id FROM users WHERE username = ?', ['usuario']);
    if (!usuario) {
        const hash = await bcrypt.hash('usuario123', 10);
        const created = await run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', ['usuario', hash, 'usuario']);
        await run('INSERT INTO user_profiles (user_id, plan, vip_status) VALUES (?, ?, ?)', [created.id, 'free', 'none']);
    }

    const users = await all('SELECT id, username FROM users');
    for (const u of users) {
        const profile = await get('SELECT id FROM user_profiles WHERE user_id = ?', [u.id]);
        if (!profile) {
            const isAdmin = u.username === 'admin';
            await run('INSERT INTO user_profiles (user_id, plan, vip_status) VALUES (?, ?, ?)', [u.id, isAdmin ? 'vip' : 'free', isAdmin ? 'active' : 'none']);
        }
    }

    const toolCount = await get('SELECT COUNT(*) as total FROM tools');
    if (!toolCount || toolCount.total === 0) {
        for (const tool of defaultTools) {
            await run(
                'INSERT INTO tools (categoria, nombre, descripcion, url, video_url, fecha, access_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [tool.categoria, tool.nombre, tool.descripcion, tool.url, tool.videoUrl, tool.fecha, tool.accessLevel]
            );
        }
    }
}

app.use(cors());
app.use(express.json());

function normalizeTool(row) {
    return {
        id: String(row.id),
        categoria: row.categoria,
        nombre: row.nombre,
        descripcion: row.descripcion,
        url: row.url,
        videoUrl: row.video_url || '',
        fecha: row.fecha,
        accessLevel: row.access_level || 'free'
    };
}

function signToken(user) {
    return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d' });
}

async function attachUserFromToken(req) {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return getUserWithProfileById(payload.sub);
    } catch (error) {
        return null;
    }
}

async function authRequired(req, res, next) {
    const user = await attachUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    req.user = user;
    next();
}

function adminRequired(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Permisos insuficientes' });
    next();
}

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, plan } = req.body;
        const normalizedUsername = String(username || '').trim().toLowerCase();
        if (!normalizedUsername || normalizedUsername.length < 3) {
            return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
        }
        if (!password || String(password).length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }
        const selectedPlan = plan === 'vip' ? 'vip' : 'free';
        const existing = await get('SELECT id FROM users WHERE username = ?', [normalizedUsername]);
        if (existing) return res.status(409).json({ error: 'Este usuario ya existe' });

        const hash = await bcrypt.hash(password, 10);
        const created = await run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [normalizedUsername, hash, 'usuario']);
        await run('INSERT INTO user_profiles (user_id, plan, vip_status) VALUES (?, ?, ?)', [created.id, selectedPlan, selectedPlan === 'vip' ? 'pending' : 'none']);
        const user = await getUserWithProfileById(created.id);
        const token = signToken(user);
        res.status(201).json({ token, user: serializeUser(user) });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo crear el usuario' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const normalizedUsername = String(username || '').trim().toLowerCase();
        if (!normalizedUsername || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
        }
        const user = await getUserWithProfileByUsername(normalizedUsername);
        if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });
        const token = signToken(user);
        res.json({ token, user: serializeUser(user) });
    } catch (error) {
        res.status(500).json({ error: 'Error interno en login' });
    }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
    res.json(serializeUser(req.user));
});

app.get('/api/subscription/options', (req, res) => {
    res.json({
        title: 'Herramientas Exclusivas VIP',
        plans: [
            { id: 'vip-monthly', name: 'VIP Mensual', price: '$9.99 USD/mes' },
            { id: 'vip-yearly', name: 'VIP Anual', price: '$89.99 USD/año' }
        ],
        methods: ['Mercado Pago', 'Stripe', 'PayPal']
    });
});

app.post('/api/subscription/create-checkout', authRequired, async (req, res) => {
    try {
        const provider = req.body.provider === 'stripe' || req.body.provider === 'paypal' ? req.body.provider : 'mercadopago';
        const planId = req.body.planId === 'vip-yearly' ? 'vip-yearly' : 'vip-monthly';
        const amount = planId === 'vip-yearly' ? 89.99 : 9.99;
        const externalReference = `vip_${req.user.id}_${Date.now()}`;

        if (provider === 'mercadopago' && !mpClient) {
            return res.status(500).json({ error: 'Mercado Pago no está configurado. Define MP_ACCESS_TOKEN en el servidor.' });
        }

        let checkoutUrl = '';
        if (provider === 'stripe') {
            checkoutUrl = planId === 'vip-yearly' ? STRIPE_CHECKOUT_YEARLY_URL : STRIPE_CHECKOUT_MONTHLY_URL;
            if (!checkoutUrl) {
                return res.status(500).json({ error: 'Stripe no está configurado. Define STRIPE_CHECKOUT_MONTHLY_URL y STRIPE_CHECKOUT_YEARLY_URL.' });
            }
        }
        if (provider === 'paypal') {
            checkoutUrl = planId === 'vip-yearly' ? PAYPAL_CHECKOUT_YEARLY_URL : PAYPAL_CHECKOUT_MONTHLY_URL;
            if (!checkoutUrl) {
                return res.status(500).json({ error: 'PayPal no está configurado. Define PAYPAL_CHECKOUT_MONTHLY_URL y PAYPAL_CHECKOUT_YEARLY_URL.' });
            }
        }

        await run(
            `INSERT INTO subscription_payments (user_id, external_reference, provider, status, amount, currency)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.user.id, externalReference, provider, 'pending', amount, 'USD']
        );

        if (provider !== 'mercadopago') {
            return res.json({ checkoutUrl, externalReference, provider, planId });
        }

        const preferenceClient = new Preference(mpClient);
        const preference = await preferenceClient.create({
            body: {
                items: [
                    {
                        title: planId === 'vip-yearly' ? 'Suscripción VIP Anual' : 'Suscripción VIP Mensual',
                        quantity: 1,
                        unit_price: amount,
                        currency_id: 'USD'
                    }
                ],
                external_reference: externalReference,
                back_urls: {
                    success: `${APP_BASE_URL}/?payment=success`,
                    failure: `${APP_BASE_URL}/?payment=failure`,
                    pending: `${APP_BASE_URL}/?payment=pending`
                },
                auto_return: 'approved',
                notification_url: `${APP_BASE_URL}/api/subscription/webhook/mercadopago`,
                metadata: {
                    user_id: req.user.id,
                    plan_id: planId
                }
            }
        });

        res.json({
            checkoutUrl: preference.init_point,
            sandboxCheckoutUrl: preference.sandbox_init_point,
            preferenceId: preference.id
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo crear el checkout de Mercado Pago' });
    }
});

app.post('/api/subscription/activate-demo', authRequired, async (req, res) => {
    return res.status(410).json({ error: 'El modo demo fue desactivado. Activa VIP completando un pago real.' });
});

app.post('/api/subscription/webhook/mercadopago', async (req, res) => {
    try {
        if (!mpClient) return res.status(200).send('ignored');
        const topic = req.query.topic || req.body.type;
        const paymentId = req.query['data.id'] || (req.body.data && req.body.data.id);
        if (topic !== 'payment' || !paymentId) return res.status(200).send('ok');

        const paymentClient = new Payment(mpClient);
        const payment = await paymentClient.get({ id: paymentId });
        const externalReference = payment.external_reference;
        if (!externalReference) return res.status(200).send('ok');

        const record = await get('SELECT * FROM subscription_payments WHERE external_reference = ?', [externalReference]);
        if (!record) return res.status(200).send('ok');

        const paymentStatus = payment.status || 'unknown';
        await run(
            `UPDATE subscription_payments
             SET status = ?, payment_id = ?, raw_payload = ?, updated_at = CURRENT_TIMESTAMP
             WHERE external_reference = ?`,
            [paymentStatus, String(payment.id || paymentId), JSON.stringify(payment), externalReference]
        );

        if (paymentStatus === 'approved') {
            await run(
                `UPDATE user_profiles
                 SET plan = 'vip', vip_status = 'active'
                 WHERE user_id = ?`,
                [record.user_id]
            );
        }

        return res.status(200).send('ok');
    } catch (error) {
        return res.status(200).send('ok');
    }
});

app.get('/api/admin/import-legacy-tools', async (req, res) => {
    try {
        if (!IMPORT_LEGACY_SECRET) {
            return res.status(500).json({ error: 'IMPORT_LEGACY_SECRET no está configurado en el servidor.' });
        }
        const key = String(req.query.key || '');
        if (!key || key !== IMPORT_LEGACY_SECRET) {
            return res.status(401).json({ error: 'No autorizado para importar herramientas legacy.' });
        }

        const summary = await importLegacyTools();
        return res.json({
            ok: true,
            legacyBaseUrl: LEGACY_BASE_URL,
            ...summary
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'No se pudo importar herramientas legacy.' });
    }
});

app.post('/api/subscription/confirm-payment', authRequired, async (req, res) => {
    try {
        if (!mpClient) {
            return res.status(500).json({ error: 'Mercado Pago no está configurado. Define MP_ACCESS_TOKEN en el servidor.' });
        }
        const rawPaymentId = req.body.paymentId || req.body.collectionId;
        const paymentId = String(rawPaymentId || '').trim();
        if (!paymentId) {
            return res.status(400).json({ error: 'paymentId es obligatorio para confirmar el pago.' });
        }

        const paymentClient = new Payment(mpClient);
        const payment = await paymentClient.get({ id: paymentId });
        const externalReference = payment.external_reference;
        if (!externalReference) {
            return res.status(400).json({ error: 'El pago no incluye referencia externa.' });
        }

        const record = await get('SELECT * FROM subscription_payments WHERE external_reference = ?', [externalReference]);
        if (!record || Number(record.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ error: 'Este pago no corresponde al usuario autenticado.' });
        }

        const paymentStatus = payment.status || 'unknown';
        await run(
            `UPDATE subscription_payments
             SET status = ?, payment_id = ?, raw_payload = ?, updated_at = CURRENT_TIMESTAMP
             WHERE external_reference = ?`,
            [paymentStatus, String(payment.id || paymentId), JSON.stringify(payment), externalReference]
        );

        if (paymentStatus === 'approved') {
            await run(
                `UPDATE user_profiles
                 SET plan = 'vip', vip_status = 'active'
                 WHERE user_id = ?`,
                [req.user.id]
            );
        }

        const refreshed = await getUserWithProfileById(req.user.id);
        return res.json({
            paymentStatus,
            user: serializeUser(refreshed)
        });
    } catch (error) {
        return res.status(500).json({ error: 'No se pudo confirmar el pago con Mercado Pago.' });
    }
});

app.get('/api/categories', async (req, res) => {
    try {
        const user = await attachUserFromToken(req);
        const vipActive = isVipActive(user);
        const rows = await all('SELECT DISTINCT categoria, access_level FROM tools ORDER BY categoria ASC');
        const categories = rows
            .filter((r) => vipActive || r.access_level !== 'vip')
            .map((r) => r.categoria);
        if (!categories.includes(VIP_CATEGORY)) categories.push(VIP_CATEGORY);
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron cargar categorías' });
    }
});

app.get('/api/tools', async (req, res) => {
    try {
        const user = await attachUserFromToken(req);
        const vipActive = isVipActive(user);
        const categoria = req.query.categoria;

        if (categoria === VIP_CATEGORY && !vipActive) {
            return res.status(403).json({ error: 'Esta categoría es exclusiva para usuarios VIP' });
        }

        let sql = 'SELECT * FROM tools';
        const params = [];
        const where = [];

        if (categoria && categoria !== 'all') {
            where.push('categoria = ?');
            params.push(categoria);
        }
        if (!vipActive) where.push("access_level = 'free'");
        if (where.length > 0) sql += ' WHERE ' + where.join(' AND ');
        sql += ' ORDER BY id DESC';

        const rows = await all(sql, params);
        res.json(rows.map(normalizeTool));
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron cargar herramientas' });
    }
});

app.post('/api/tools', authRequired, adminRequired, async (req, res) => {
    try {
        const { categoria, nombre, descripcion, url, videoUrl, fecha, accessLevel } = req.body;
        if (!categoria || !nombre || !descripcion || !url || !fecha) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        const finalAccess = categoria === VIP_CATEGORY ? 'vip' : (accessLevel === 'vip' ? 'vip' : 'free');
        const result = await run(
            'INSERT INTO tools (categoria, nombre, descripcion, url, video_url, fecha, access_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [categoria, nombre, descripcion, url, videoUrl || '', fecha, finalAccess]
        );
        const created = await get('SELECT * FROM tools WHERE id = ?', [result.id]);
        res.status(201).json(normalizeTool(created));
    } catch (error) {
        res.status(500).json({ error: 'No se pudo crear la herramienta' });
    }
});

app.put('/api/tools/:id', authRequired, adminRequired, async (req, res) => {
    try {
        const { id } = req.params;
        const { categoria, nombre, descripcion, url, videoUrl, fecha, accessLevel } = req.body;
        if (!categoria || !nombre || !descripcion || !url || !fecha) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        const finalAccess = categoria === VIP_CATEGORY ? 'vip' : (accessLevel === 'vip' ? 'vip' : 'free');
        await run(
            'UPDATE tools SET categoria = ?, nombre = ?, descripcion = ?, url = ?, video_url = ?, fecha = ?, access_level = ? WHERE id = ?',
            [categoria, nombre, descripcion, url, videoUrl || '', fecha, finalAccess, id]
        );
        const updated = await get('SELECT * FROM tools WHERE id = ?', [id]);
        if (!updated) return res.status(404).json({ error: 'Herramienta no encontrada' });
        res.json(normalizeTool(updated));
    } catch (error) {
        res.status(500).json({ error: 'No se pudo actualizar la herramienta' });
    }
});

app.delete('/api/tools/:id', authRequired, adminRequired, async (req, res) => {
    try {
        const result = await run('DELETE FROM tools WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Herramienta no encontrada' });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'No se pudo eliminar la herramienta' });
    }
});

app.get('/api/forum/comments', async (req, res) => {
    try {
        const rows = await all('SELECT id, username, content, created_at FROM forum_comments ORDER BY id DESC LIMIT 100');
        res.json(rows.map((row) => ({
            id: String(row.id),
            username: row.username,
            content: row.content,
            createdAt: row.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: 'No se pudieron cargar comentarios' });
    }
});

app.post('/api/forum/comments', authRequired, async (req, res) => {
    try {
        const content = String(req.body.content || '').trim();
        if (content.length < 2) return res.status(400).json({ error: 'Escribe un comentario válido' });
        const result = await run(
            'INSERT INTO forum_comments (user_id, username, content) VALUES (?, ?, ?)',
            [req.user.id, req.user.username, content]
        );
        const created = await get('SELECT id, username, content, created_at FROM forum_comments WHERE id = ?', [result.id]);
        res.status(201).json({
            id: String(created.id),
            username: created.username,
            content: created.content,
            createdAt: created.created_at
        });
    } catch (error) {
        res.status(500).json({ error: 'No se pudo publicar el comentario' });
    }
});

app.use(express.static(__dirname));
app.get('/*splat', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

initializeDatabase()
    .then(() => app.listen(PORT, () => console.log(`Servidor You-Space listo en puerto ${PORT}`)))
    .catch((error) => {
        console.error('Error al inicializar base de datos:', error);
        process.exit(1);
    });
