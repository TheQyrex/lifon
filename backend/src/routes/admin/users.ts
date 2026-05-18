import { Hono } from 'hono';
import type { AppEnv } from '../../env';

const users = new Hono<AppEnv>();

// GET /admin/users — список с пагинацией и поиском
users.get('/', async (c) => {
    const limit  = Math.min(100, Math.max(1, Number(c.req.query('limit'))  || 50));
    const offset = Math.max(0, Number(c.req.query('offset')) || 0);
    const q      = (c.req.query('q') || '').trim();

    const where  = q ? 'WHERE username LIKE ?' : '';
    const binds  = q ? [`%${q.toLowerCase()}%`, limit, offset] : [limit, offset];

    const rows = await c.env.DB.prepare(
        `SELECT u.id, u.username, u.is_admin, u.created_at, u.last_seen_at,
                (SELECT COUNT(*) FROM listens l WHERE l.user_id = u.id) AS listens,
                (SELECT COUNT(*) FROM likes   k WHERE k.user_id = u.id) AS likes
         FROM users u
         ${where}
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
    ).bind(...binds).all<{
        id: number; username: string; is_admin: number;
        created_at: number; last_seen_at: number | null;
        listens: number; likes: number;
    }>();

    const totalRow = await c.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM users ${where}`,
    ).bind(...(q ? [`%${q.toLowerCase()}%`] : [])).first<{ n: number }>();

    return c.json({
        ok: true,
        users: rows.results.map((u) => ({
            id: u.id,
            username: u.username,
            is_admin: !!u.is_admin,
            created_at: u.created_at,
            last_seen_at: u.last_seen_at,
            listens: u.listens,
            likes: u.likes,
        })),
        total: totalRow?.n ?? 0,
        limit,
        offset,
    });
});

// GET /admin/users/:id — детальная карточка с топом треков и общими цифрами
users.get('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const u = await c.env.DB.prepare(
        `SELECT id, username, is_admin, created_at, last_seen_at
         FROM users WHERE id = ?`,
    ).bind(id).first<{
        id: number; username: string; is_admin: number;
        created_at: number; last_seen_at: number | null;
    }>();
    if (!u) return c.json({ ok: false, error: 'not_found' }, 404);

    const totals = await c.env.DB.prepare(
        `SELECT
            (SELECT COUNT(*) FROM listens WHERE user_id = ?) AS listens,
            (SELECT COUNT(DISTINCT track_id) FROM listens WHERE user_id = ?) AS unique_tracks,
            (SELECT COALESCE(SUM(duration_ms), 0) FROM listens WHERE user_id = ?) AS listen_ms,
            (SELECT COUNT(*) FROM likes WHERE user_id = ?) AS likes`,
    ).bind(id, id, id, id).first<{
        listens: number; unique_tracks: number; listen_ms: number; likes: number;
    }>();

    const topTracks = await c.env.DB.prepare(
        `SELECT l.track_id, t.title, t.artist, a.title AS album_title,
                COUNT(*) AS plays
         FROM listens l
         LEFT JOIN tracks t ON t.id = l.track_id
         LEFT JOIN albums a ON a.id = t.album_id
         WHERE l.user_id = ?
         GROUP BY l.track_id, t.title, t.artist, a.title
         ORDER BY plays DESC
         LIMIT 10`,
    ).bind(id).all<{
        track_id: number; title: string | null; artist: string | null;
        album_title: string | null; plays: number;
    }>();

    const recentLikes = await c.env.DB.prepare(
        `SELECT k.track_id, t.title, t.artist, a.title AS album_title, k.created_at
         FROM likes k
         LEFT JOIN tracks t ON t.id = k.track_id
         LEFT JOIN albums a ON a.id = t.album_id
         WHERE k.user_id = ?
         ORDER BY k.created_at DESC
         LIMIT 20`,
    ).bind(id).all<{
        track_id: number; title: string | null; artist: string | null;
        album_title: string | null; created_at: number;
    }>();

    return c.json({
        ok: true,
        user: {
            id: u.id,
            username: u.username,
            is_admin: !!u.is_admin,
            created_at: u.created_at,
            last_seen_at: u.last_seen_at,
        },
        totals: {
            listens: totals?.listens ?? 0,
            unique_tracks: totals?.unique_tracks ?? 0,
            listen_ms: totals?.listen_ms ?? 0,
            likes: totals?.likes ?? 0,
        },
        top_tracks: topTracks.results,
        recent_likes: recentLikes.results,
    });
});

// PATCH /admin/users/:id — пока меняем только is_admin
users.patch('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const me = c.get('user')!;
    if (id === me.id) {
        return c.json({ ok: false, error: 'cannot_self_modify', message: 'Нельзя менять свои права' }, 400);
    }

    const body = await c.req.json<{ is_admin?: unknown }>().catch(() => null);
    if (!body || typeof body.is_admin !== 'boolean') {
        return c.json({ ok: false, error: 'bad_request' }, 400);
    }

    const info = await c.env.DB.prepare(
        'UPDATE users SET is_admin = ? WHERE id = ?',
    ).bind(body.is_admin ? 1 : 0, id).run();

    if (!info.meta.changes) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({ ok: true });
});

// DELETE /admin/users/:id — каскадно удаляются listens/likes (ON DELETE CASCADE)
users.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const me = c.get('user')!;
    if (id === me.id) {
        return c.json({ ok: false, error: 'cannot_self_delete', message: 'Нельзя удалить самого себя' }, 400);
    }

    const info = await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    if (!info.meta.changes) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({ ok: true });
});

export default users;
