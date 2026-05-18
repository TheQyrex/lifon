import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { publicUrl } from '../../lib/r2';
import {
    validateBroadcastKind,
    validateNonEmptyString,
    validateOptionalString,
    validationErrorResponse,
} from '../../lib/validation';

const broadcasts = new Hono<AppEnv>();

broadcasts.get('/', async (c) => {
    const hasMeta = await hasBroadcastMeta(c.env.DB);
    const rows = await c.env.DB.prepare(
        `SELECT b.id, b.kind, b.title, b.body, b.image_key, ${hasMeta ? 'b.meta' : 'NULL AS meta'}, b.is_active, b.created_at,
                u.username AS author
         FROM broadcasts b
         LEFT JOIN users u ON u.id = b.created_by
         ORDER BY b.created_at DESC
         LIMIT 100`,
    ).all<{
        id: number;
        kind: 'notification' | 'banner';
        title: string;
        body: string | null;
        image_key: string | null;
        meta: string | null;
        is_active: number;
        created_at: number;
        author: string | null;
    }>();

    return c.json({
        ok: true,
        items: rows.results.map(r => ({
            id: r.id,
            kind: r.kind,
            title: r.title,
            body: r.body,
            image_url: publicUrl(c.env, r.image_key),
            meta: r.meta,
            is_active: !!r.is_active,
            created_at: r.created_at,
            author: r.author,
        })),
    });
});

broadcasts.post('/', async (c) => {
    const user = c.get('user')!;

    let kind: 'notification' | 'banner';
    let title: string;
    let body: string | null;
    let imageKey: string | null;
    let meta: string | null;
    try {
        const payload = await c.req.json<{
            kind?: unknown;
            title?: unknown;
            body?: unknown;
            image_key?: unknown;
            meta?: unknown;
        }>();
        kind = validateBroadcastKind(payload.kind);
        title = validateNonEmptyString('title', payload.title, kind === 'notification' ? 80 : 200);
        body = kind === 'banner' ? validateOptionalString('body', payload.body, 5000) : null;
        imageKey = kind === 'banner' ? validateOptionalString('image_key', payload.image_key, 300) : null;
        meta = kind === 'banner' ? validateOptionalString('meta', payload.meta, 2000) : null;
    } catch (err) {
        return validationErrorResponse(c, err);
    }
    const hasMeta = await hasBroadcastMeta(c.env.DB);

    // Deactivate previous broadcasts of the same kind so the public endpoint
    // returns at most one per kind.
    await c.env.DB.prepare('UPDATE broadcasts SET is_active = 0 WHERE kind = ? AND is_active = 1')
        .bind(kind).run();

    const row = hasMeta
        ? await c.env.DB.prepare(
            `INSERT INTO broadcasts (kind, title, body, image_key, meta, is_active, created_by)
             VALUES (?, ?, ?, ?, ?, 1, ?)
             RETURNING id`,
        ).bind(kind, title, body, imageKey, meta, user.id).first<{ id: number }>()
        : await c.env.DB.prepare(
            `INSERT INTO broadcasts (kind, title, body, image_key, is_active, created_by)
             VALUES (?, ?, ?, ?, 1, ?)
             RETURNING id`,
        ).bind(kind, title, body, imageKey, user.id).first<{ id: number }>();

    return c.json({ ok: true, id: row?.id });
});

broadcasts.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    await c.env.DB.prepare('UPDATE broadcasts SET is_active = 0 WHERE id = ?').bind(id).run();
    return c.json({ ok: true });
});

export default broadcasts;

async function hasBroadcastMeta(db: D1Database): Promise<boolean> {
    const info = await db.prepare('PRAGMA table_info(broadcasts)').all<{ name: string }>();
    return info.results.some(col => col.name === 'meta');
}
