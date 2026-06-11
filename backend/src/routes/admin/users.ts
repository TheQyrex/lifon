import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { hashPassword } from '../../lib/crypto';
import { validatePassword, validateUsername, validationErrorResponse } from '../../lib/validation';

const users = new Hono<AppEnv>();

// POST /admin/users/reset-all-passwords — сброс паролей всем пользователям
users.post('/reset-all-passwords', async (c) => {
    await c.env.DB.prepare(
        "UPDATE users SET password_hash = '', password_salt = '', password_iter = 0",
    ).run();
    return c.json({ ok: true });
});

// GET /admin/users — список с пагинацией и поиском
users.get('/', async (c) => {
    const limit  = Math.min(100, Math.max(1, Number(c.req.query('limit'))  || 50));
    const offset = Math.max(0, Number(c.req.query('offset')) || 0);
    const q      = (c.req.query('q') || '').trim();

    const where  = q ? 'WHERE username LIKE ?' : '';
    const binds  = q ? [`%${q.toLowerCase()}%`, limit, offset] : [limit, offset];

    const rows = await c.env.DB.prepare(
        `SELECT u.id, u.username, u.is_admin, u.created_at, u.last_seen_at,
                u.telegram_id, u.require_telegram,
                (SELECT COUNT(*) FROM listens l WHERE l.user_id = u.id) AS listens,
                (SELECT COUNT(*) FROM likes   k WHERE k.user_id = u.id) AS likes
         FROM users u
         ${where}
         ORDER BY u.created_at DESC
         LIMIT ? OFFSET ?`,
    ).bind(...binds).all<{
        id: number; username: string; is_admin: number;
        created_at: number; last_seen_at: number | null;
        telegram_id: number | null; require_telegram: number;
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
            telegram_id: u.telegram_id,
            require_telegram: !!u.require_telegram,
            listens: u.listens,
            likes: u.likes,
        })),
        total: totalRow?.n ?? 0,
        limit,
        offset,
    });
});

// POST /admin/users — ручное создание пользователя
users.post('/', async (c) => {
    let username: string;
    let password: string;
    let require_telegram: boolean;
    try {
        const body = await c.req.json<{ username?: unknown; password?: unknown; require_telegram?: unknown }>();
        username = validateUsername(body.username);
        password = validatePassword(body.password);
        require_telegram = body.require_telegram === true;
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const taken = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (taken) return c.json({ ok: false, error: 'username_taken', message: 'Это имя уже занято' }, 409);

    const { hash, salt, iterations } = await hashPassword(password);

    const inserted = await c.env.DB.prepare(
        'INSERT INTO users (username, password_hash, password_salt, password_iter, require_telegram) VALUES (?, ?, ?, ?, ?) RETURNING id',
    ).bind(username, hash, salt, iterations, require_telegram ? 1 : 0).first<{ id: number }>();

    if (!inserted) return c.json({ ok: false, error: 'server_error' }, 500);
    return c.json({ ok: true, id: inserted.id }, 201);
});

// GET /admin/users/:id — детальная карточка
users.get('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const u = await c.env.DB.prepare(
        `SELECT id, username, is_admin, created_at, last_seen_at, telegram_id, require_telegram
         FROM users WHERE id = ?`,
    ).bind(id).first<{
        id: number; username: string; is_admin: number;
        created_at: number; last_seen_at: number | null;
        telegram_id: number | null; require_telegram: number;
    }>();
    if (!u) return c.json({ ok: false, error: 'not_found' }, 404);

    const totals = await c.env.DB.prepare(
        `SELECT
            (SELECT COUNT(*) FROM listens WHERE user_id = ?) AS listens_real,
            (SELECT COUNT(DISTINCT track_id) FROM listens WHERE user_id = ?) AS unique_tracks_real,
            (SELECT COALESCE(SUM(duration_ms), 0) FROM listens WHERE user_id = ?) AS listen_ms_real,
            (SELECT COUNT(*) FROM likes WHERE user_id = ?) AS likes,
            u.listens_bonus, u.listen_ms_bonus, u.unique_tracks_bonus
         FROM users u WHERE u.id = ?`,
    ).bind(id, id, id, id, id).first<{
        listens_real: number; unique_tracks_real: number; listen_ms_real: number; likes: number;
        listens_bonus: number; listen_ms_bonus: number; unique_tracks_bonus: number;
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

    const allLikes = await c.env.DB.prepare(
        `SELECT k.track_id, t.title, t.artist, a.title AS album_title, k.created_at
         FROM likes k
         LEFT JOIN tracks t ON t.id = k.track_id
         LEFT JOIN albums a ON a.id = t.album_id
         WHERE k.user_id = ?
         ORDER BY k.created_at DESC`,
    ).bind(id).all<{
        track_id: number; title: string | null; artist: string | null;
        album_title: string | null; created_at: number;
    }>();

    const bonuses = {
        listens_bonus: totals?.listens_bonus ?? 0,
        listen_ms_bonus: totals?.listen_ms_bonus ?? 0,
        unique_tracks_bonus: totals?.unique_tracks_bonus ?? 0,
    };

    return c.json({
        ok: true,
        user: {
            id: u.id,
            username: u.username,
            is_admin: !!u.is_admin,
            created_at: u.created_at,
            last_seen_at: u.last_seen_at,
            telegram_id: u.telegram_id,
            require_telegram: !!u.require_telegram,
        },
        totals: {
            listens: (totals?.listens_real ?? 0) + bonuses.listens_bonus,
            unique_tracks: (totals?.unique_tracks_real ?? 0) + bonuses.unique_tracks_bonus,
            listen_ms: (totals?.listen_ms_real ?? 0) + bonuses.listen_ms_bonus,
            likes: totals?.likes ?? 0,
            // raw values for admin editing
            listens_real: totals?.listens_real ?? 0,
            unique_tracks_real: totals?.unique_tracks_real ?? 0,
            listen_ms_real: totals?.listen_ms_real ?? 0,
            ...bonuses,
        },
        top_tracks: topTracks.results,
        likes: allLikes.results,
    });
});

// PATCH /admin/users/:id — изменение полей: is_admin, require_telegram, telegram_id, password
users.patch('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const me = c.get('user')!;
    if (id === me.id) {
        return c.json({ ok: false, error: 'cannot_self_modify', message: 'Нельзя менять свои права' }, 400);
    }

    const body = await c.req.json<{
        is_admin?: unknown;
        require_telegram?: unknown;
        telegram_id?: unknown;
        password?: unknown;
        listens_bonus?: unknown;
        listen_ms_bonus?: unknown;
        unique_tracks_bonus?: unknown;
    }>().catch(() => null);
    if (!body) return c.json({ ok: false, error: 'bad_request' }, 400);

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (typeof body.is_admin === 'boolean') {
        setClauses.push('is_admin = ?');
        values.push(body.is_admin ? 1 : 0);
    }
    if (typeof body.require_telegram === 'boolean') {
        setClauses.push('require_telegram = ?');
        values.push(body.require_telegram ? 1 : 0);
    }
    if ('telegram_id' in body) {
        if (body.telegram_id === null || typeof body.telegram_id === 'number') {
            setClauses.push('telegram_id = ?');
            values.push(body.telegram_id);
        }
    }
    if (typeof body.listens_bonus === 'number' && Number.isInteger(body.listens_bonus)) {
        setClauses.push('listens_bonus = ?');
        values.push(Math.max(0, body.listens_bonus));
    }
    if (typeof body.listen_ms_bonus === 'number' && Number.isInteger(body.listen_ms_bonus)) {
        setClauses.push('listen_ms_bonus = ?');
        values.push(Math.max(0, body.listen_ms_bonus));
    }
    if (typeof body.unique_tracks_bonus === 'number' && Number.isInteger(body.unique_tracks_bonus)) {
        setClauses.push('unique_tracks_bonus = ?');
        values.push(Math.max(0, body.unique_tracks_bonus));
    }
    if (body.password !== undefined) {
        let pw: string;
        try {
            pw = validatePassword(body.password);
        } catch (err) {
            return validationErrorResponse(c, err);
        }
        const { hash, salt, iterations } = await hashPassword(pw);
        setClauses.push('password_hash = ?', 'password_salt = ?', 'password_iter = ?');
        values.push(hash, salt, iterations);
    }

    if (setClauses.length === 0) return c.json({ ok: false, error: 'bad_request', message: 'Нет полей для обновления' }, 400);

    values.push(id);
    const info = await c.env.DB.prepare(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
    ).bind(...values).run();

    if (!info.meta.changes) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({ ok: true });
});

// POST /admin/users/:id/likes — добавить лайк пользователю
users.post('/:id/likes', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const body = await c.req.json<{ track_id?: unknown }>().catch(() => null);
    const trackId = typeof body?.track_id === 'number' ? body.track_id : Number(body?.track_id);
    if (!Number.isInteger(trackId) || trackId <= 0) {
        return c.json({ ok: false, error: 'bad_track_id' }, 400);
    }

    const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
    if (!user) return c.json({ ok: false, error: 'not_found' }, 404);

    await c.env.DB.prepare(
        'INSERT OR IGNORE INTO likes (user_id, track_id) VALUES (?, ?)',
    ).bind(id, trackId).run();

    return c.json({ ok: true });
});

// DELETE /admin/users/:id/likes/:trackId — удалить лайк у пользователя
users.delete('/:id/likes/:trackId', async (c) => {
    const id = Number(c.req.param('id'));
    const trackId = Number(c.req.param('trackId'));
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(trackId) || trackId <= 0) {
        return c.json({ ok: false, error: 'bad_id' }, 400);
    }

    await c.env.DB.prepare('DELETE FROM likes WHERE user_id = ? AND track_id = ?').bind(id, trackId).run();
    return c.json({ ok: true });
});

// DELETE /admin/users/:id
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
