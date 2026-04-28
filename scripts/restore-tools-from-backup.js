const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const backupFile = process.argv[2] || path.join(process.cwd(), 'backups', 'backup-production-1777389911743.json');
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'you-space.db');

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

async function main() {
    if (!fs.existsSync(backupFile)) throw new Error(`No existe backup: ${backupFile}`);
    const raw = fs.readFileSync(backupFile, 'utf8');
    const backup = JSON.parse(raw);
    const tools = Array.isArray(backup.tools) ? backup.tools : [];
    const categories = Array.isArray(backup.categories) ? backup.categories : [];

    const db = new sqlite3.Database(dbPath);
    const snapshotPath = `${dbPath}.snapshot-${Date.now()}`;
    if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, snapshotPath);

    try {
        await run(db, `
            CREATE TABLE IF NOT EXISTS tools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                categoria TEXT NOT NULL,
                nombre TEXT NOT NULL,
                descripcion TEXT NOT NULL,
                url TEXT NOT NULL,
                video_url TEXT DEFAULT '',
                fecha TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                access_level TEXT NOT NULL DEFAULT 'free'
            )
        `);
        await run(db, `
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                access_level TEXT NOT NULL DEFAULT 'free',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await run(db, 'BEGIN TRANSACTION');
        await run(db, 'DELETE FROM tools');
        await run(db, 'DELETE FROM categories');

        for (const name of categories) {
            const accessLevel = String(name) === 'Herramientas Exclusivas VIP' ? 'vip' : 'free';
            await run(db, 'INSERT INTO categories (name, access_level) VALUES (?, ?)', [String(name), accessLevel]);
        }

        for (const t of tools) {
            const categoria = String(t.categoria || '').trim();
            const accessLevel = t.accessLevel === 'vip' || categoria === 'Herramientas Exclusivas VIP' ? 'vip' : 'free';
            await run(
                db,
                `INSERT INTO tools (categoria, nombre, descripcion, url, video_url, fecha, access_level)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    categoria,
                    String(t.nombre || '').trim(),
                    String(t.descripcion || '').trim(),
                    String(t.url || '').trim(),
                    String(t.videoUrl || '').trim(),
                    String(t.fecha || '').trim(),
                    accessLevel
                ]
            );
        }
        await run(db, 'COMMIT');

        console.log(
            JSON.stringify(
                {
                    ok: true,
                    backupFile,
                    dbPath,
                    snapshotPath,
                    restoredCategories: categories.length,
                    restoredTools: tools.length
                },
                null,
                2
            )
        );
    } catch (error) {
        try { await run(db, 'ROLLBACK'); } catch (_e) {}
        throw error;
    } finally {
        db.close();
    }
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
