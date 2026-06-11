import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { deleteFromR2, publicUrl, uploadToR2, UploadError } from '../lib/r2';

const profile = new Hono<AppEnv>();

profile.use('*', requireAuth);

// POST /profile/ping — обновляет last_seen_at для онлайн-трекинга (вызывается с мобильного приложения)
profile.post('/ping', async (c) => {
    const user = c.get('user')!;
    await c.env.DB.prepare('UPDATE users SET last_seen_at = unixepoch() WHERE id = ?')
        .bind(user.id).run();
    return c.json({ ok: true });
});

profile.get('/', async (c) => {
    const user = c.get('user')!;
    const row = await c.env.DB.prepare(
        'SELECT id, username, is_admin, avatar_key, created_at, telegram_id, require_telegram FROM users WHERE id = ?',
    ).bind(user.id).first<{
        id: number;
        username: string;
        is_admin: number;
        avatar_key: string | null;
        created_at: number;
        telegram_id: number | null;
        require_telegram: number;
    }>();

    if (!row) return c.json({ ok: false, error: 'not_found' }, 404);

    const totals = await c.env.DB.prepare(
        `SELECT
            (SELECT COUNT(*) FROM listens WHERE user_id = ?) + u.listens_bonus AS listens,
            (SELECT COALESCE(SUM(duration_ms), 0) FROM listens WHERE user_id = ?) + u.listen_ms_bonus AS listen_ms,
            (SELECT COUNT(*) FROM likes WHERE user_id = ?) AS likes,
            (SELECT COUNT(DISTINCT track_id) FROM listens WHERE user_id = ?) + u.unique_tracks_bonus AS unique_tracks
         FROM users u WHERE u.id = ?`,
    ).bind(user.id, user.id, user.id, user.id, user.id).first<{ listens: number; listen_ms: number; likes: number; unique_tracks: number }>();

    const topTracks = await c.env.DB.prepare(
        `SELECT l.track_id, t.title, t.artist, a.title AS album_title, a.cover_key, COUNT(*) AS plays
         FROM listens l
         LEFT JOIN tracks t ON t.id = l.track_id
         LEFT JOIN albums a ON a.id = t.album_id
         WHERE l.user_id = ?
         GROUP BY l.track_id, t.title, t.artist, a.title, a.cover_key
         ORDER BY plays DESC
         LIMIT 5`,
    ).bind(user.id).all<{
        track_id: number; title: string | null; artist: string | null;
        album_title: string | null; cover_key: string | null; plays: number;
    }>();

    return c.json({
        ok: true,
        user: {
            id: row.id,
            username: row.username,
            is_admin: !!row.is_admin,
            avatar_url: publicUrl(c.env, row.avatar_key),
            created_at: row.created_at,
            telegram_id: row.telegram_id,
            require_telegram: !!row.require_telegram,
        },
        totals: {
            listens: totals?.listens ?? 0,
            listen_ms: totals?.listen_ms ?? 0,
            likes: totals?.likes ?? 0,
            unique_tracks: totals?.unique_tracks ?? 0,
        },
        top_tracks: topTracks.results.map(t => ({
            track_id: t.track_id,
            title: t.title,
            artist: t.artist,
            album_title: t.album_title,
            cover_url: publicUrl(c.env, t.cover_key),
            plays: t.plays,
        })),
    });
});

profile.post('/avatar', async (c) => {
    const user = c.get('user')!;

    let form: FormData;
    try {
        form = await c.req.formData();
    } catch {
        return c.json({ ok: false, error: 'invalid_form' }, 400);
    }
    const file = form.get('file') as File | null;
    if (!file || typeof file !== 'object' || typeof file.stream !== 'function') {
        return c.json({ ok: false, error: 'no_file' }, 400);
    }

    let uploaded;
    try {
        uploaded = await uploadToR2(c.env, 'avatar', file);
    } catch (err) {
        if (err instanceof UploadError) return c.json({ ok: false, error: err.message }, err.status as any);
        throw err;
    }

    const previous = await c.env.DB.prepare('SELECT avatar_key FROM users WHERE id = ?')
        .bind(user.id).first<{ avatar_key: string | null }>();

    await c.env.DB.prepare('UPDATE users SET avatar_key = ? WHERE id = ?')
        .bind(uploaded.key, user.id).run();

    // Best-effort cleanup of the old avatar; ignore failures.
    if (previous?.avatar_key) {
        c.executionCtx.waitUntil(deleteFromR2(c.env, previous.avatar_key));
    }

    return c.json({ ok: true, avatar_url: uploaded.url });
});

profile.delete('/avatar', async (c) => {
    const user = c.get('user')!;
    const row = await c.env.DB.prepare('SELECT avatar_key FROM users WHERE id = ?')
        .bind(user.id).first<{ avatar_key: string | null }>();

    await c.env.DB.prepare('UPDATE users SET avatar_key = NULL WHERE id = ?')
        .bind(user.id).run();

    if (row?.avatar_key) c.executionCtx.waitUntil(deleteFromR2(c.env, row.avatar_key));

    return c.json({ ok: true });
});

export default profile;
