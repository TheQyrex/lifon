import 'dotenv/config';
import { serve } from '@hono/node-server';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import app from './index';
import { D1Adapter } from './adapters/db';
import { MemoryKV } from './adapters/kv';
import { FSStorage } from './adapters/storage';

// ── Required env vars ──────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error('FATAL: JWT_SECRET is not set'); process.exit(1); }

const ALLOWED_ORIGINS   = process.env.ALLOWED_ORIGINS   ?? 'https://test.lifonmusic.lol';
const MEDIA_PUBLIC_BASE = process.env.MEDIA_PUBLIC_BASE ?? 'https://api.test.lifonmusic.lol/media';
const ASSETS_BASE       = process.env.ASSETS_BASE;
const ADMIN_BOOTSTRAP   = process.env.ADMIN_BOOTSTRAP;

// ── Paths ──────────────────────────────────────────────────────────────────
const DATA_DIR  = process.env.DATA_DIR  ?? path.join(__dirname, '../data');
const MEDIA_DIR = process.env.MEDIA_DIR ?? path.join(DATA_DIR, 'media');
const DB_PATH   = process.env.DB_PATH   ?? path.join(DATA_DIR, 'db.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

// ── SQLite ─────────────────────────────────────────────────────────────────
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Apply migrations that haven't run yet
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`);

const migrationsDir = path.join(__dirname, '../migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

for (const file of migrationFiles) {
    const alreadyRun = sqlite
        .prepare('SELECT 1 FROM _migrations WHERE name = ?')
        .get(file);
    if (alreadyRun) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sqlite.exec(sql);
    sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`migration applied: ${file}`);
}

// ── Adapters ───────────────────────────────────────────────────────────────
const db          = new D1Adapter(sqlite);
const ratelimitKv = new MemoryKV();
const notifKv     = new MemoryKV();
const storage     = new FSStorage(MEDIA_DIR);

// Prune expired KV entries every 10 minutes
setInterval(() => { ratelimitKv.prune(); notifKv.prune(); }, 10 * 60 * 1000).unref();

// ── Bindings object (replaces Cloudflare env) ──────────────────────────────
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const bindings = {
    DB:                db,
    MEDIA:             storage,
    RATELIMIT:         ratelimitKv,
    NOTIFICATIONS:     notifKv,
    JWT_SECRET,
    ALLOWED_ORIGINS,
    MEDIA_PUBLIC_BASE,
    ASSETS_BASE,
    ADMIN_BOOTSTRAP,
    TELEGRAM_BOT_TOKEN,
};

// Fake Workers ExecutionContext — waitUntil just runs the promise in background
const fakeCtx = {
    waitUntil: (p: Promise<unknown>) => { p.catch(console.error); },
    passThroughOnException: () => {},
};

// ── HTTP server ────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3001);

serve({
    fetch: (req) => app.fetch(req, bindings as any, fakeCtx as any),
    port: PORT,
}, (info) => {
    console.log(`LifonMUSIC API running on http://localhost:${info.port}`);
});
