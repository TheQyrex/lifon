import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { publicUrl } from '../lib/r2';

const notifications = new Hono<AppEnv>();

// Public endpoint — returns the currently active broadcasts (compact + banner).
// Frontend polls this on load and shows whichever rows are present.
notifications.get('/', async (c) => {
    const hasMeta = await hasBroadcastMeta(c.env.DB);
    const rows = await c.env.DB.prepare(
        `SELECT id, kind, title, body, image_key, ${hasMeta ? 'meta' : 'NULL AS meta'}, created_at
         FROM broadcasts
         WHERE is_active = 1
         ORDER BY created_at DESC`,
    ).all<{
        id: number;
        kind: 'notification' | 'banner';
        title: string;
        body: string | null;
        image_key: string | null;
        meta: string | null;
        created_at: number;
    }>();

    // Keep only the most recent of each kind.
    const seen = new Set<string>();
    const items = [];
    for (const row of rows.results) {
        if (seen.has(row.kind)) continue;
        seen.add(row.kind);
        items.push({
            id: row.id,
            kind: row.kind,
            title: row.title,
            body: row.body,
            image_url: publicUrl(c.env, row.image_key),
            meta: row.meta,
            created_at: row.created_at,
        });
    }

    return c.json({ ok: true, items });
});

export default notifications;

async function hasBroadcastMeta(db: D1Database): Promise<boolean> {
    const info = await db.prepare('PRAGMA table_info(broadcasts)').all<{ name: string }>();
    return info.results.some(col => col.name === 'meta');
}
