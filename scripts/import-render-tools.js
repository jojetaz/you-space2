const sqlite3 = require('sqlite3').verbose();

const OLD_BASE_URL = 'https://you-space-app-1.onrender.com';
const NEW_DB_PATH = 'data/you-space.db';

const categoryMap = {
    'Generacion de video e imagen': 'Generación de Video e IA',
    'Generación de Imágenes': 'Diseño Gráfico',
    'Tips impresoras 3d': 'Impresoras 3D',
    'herramientas de reparacion': 'Herramientas de Reparación',
    'Presentaciones y analisis de datos': 'Presentaciones y Datos',
    'Crear paginas web y app': 'Crear Páginas Web',
    'negocios': 'Ofertas y Viajes',
    'Generar imagen 3D': 'Imagen 3D',
    'Audio y musica': 'Audio y Edición',
    'Herramientas de busqueda': 'Recursos de IA',
    'Herramientas utiles variadas': 'Recursos de IA',
    'Renderizar y optimizar planos': 'Diseño Gráfico'
};

function normalizeCategoryName(name) {
    return categoryMap[name] || name;
}

function clean(text) {
    return String(text || '')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseCategoryPage(html) {
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
    const category = titleMatch ? clean(titleMatch[1]) : '';
    if (!category || category.toLowerCase().includes('portafolio')) return null;

    const rows = [];
    const tableRows = html.match(/<tr>[\s\S]*?<\/tr>/gi) || [];
    for (const rowHtml of tableRows) {
        const cols = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
        if (cols.length < 5) continue;

        const nombre = clean(cols[0]);
        const descripcion = clean(cols[1]);
        const urlMatch = cols[2].match(/href=["']([^"']+)["']/i);
        const videoMatch = cols[3].match(/href=["']([^"']+)["']/i);
        const fecha = clean(cols[4]);
        if (!nombre || !urlMatch) continue;

        rows.push({
            categoria: normalizeCategoryName(category),
            nombre,
            descripcion: descripcion || 'Sin descripción',
            url: urlMatch[1],
            videoUrl: videoMatch ? videoMatch[1] : '',
            fecha: fecha || new Date().toLocaleDateString('es-CL')
        });
    }

    return { category, rows };
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

async function main() {
    const homeRes = await fetch(`${OLD_BASE_URL}/`);
    if (!homeRes.ok) throw new Error(`No se pudo cargar home antigua (${homeRes.status})`);
    const homeHtml = await homeRes.text();
    const ids = Array.from(new Set((homeHtml.match(/\/categoria\/\d+/g) || []).map((m) => Number(m.split('/').pop()))))
        .filter((id) => Number.isInteger(id))
        .sort((a, b) => a - b);

    const db = new sqlite3.Database(NEW_DB_PATH);
    let fetchedCategories = 0;
    let totalRows = 0;
    let inserted = 0;
    let skipped = 0;

    for (const id of ids) {
        const res = await fetch(`${OLD_BASE_URL}/categoria/${id}`);
        if (!res.ok) continue;
        const html = await res.text();
        const parsed = parseCategoryPage(html);
        if (!parsed) continue;

        fetchedCategories += 1;
        totalRows += parsed.rows.length;

        for (const tool of parsed.rows) {
            const existing = await dbGet(
                db,
                'SELECT id FROM tools WHERE categoria = ? AND nombre = ? AND url = ?',
                [tool.categoria, tool.nombre, tool.url]
            );
            if (existing) {
                skipped += 1;
                continue;
            }
            await dbRun(
                db,
                'INSERT INTO tools (categoria, nombre, descripcion, url, video_url, fecha, access_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [tool.categoria, tool.nombre, tool.descripcion, tool.url, tool.videoUrl, tool.fecha, 'free']
            );
            inserted += 1;
        }
    }

    db.close();
    console.log(
        JSON.stringify(
            { fetchedCategories, totalRows, inserted, skipped, ids },
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
