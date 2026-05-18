import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { validateTrackId, validationErrorResponse } from '../lib/validation';

const likes = new Hono<AppEnv>();

likes.use('*', requireAuth);

likes.get('/', async (c) => {
    const user = c.get('user')!;
    const result = await c.env.DB.prepare(
        'SELECT track_id FROM likes WHERE user_id = ? ORDER BY created_at DESC',
    ).bind(user.id).all<{ track_id: number }>();
    return c.json({ ok: true, liked: result.results.map(r => r.track_id) });
});

likes.post('/', async (c) => {
    const user = c.get('user')!;
    let trackId: number;
    try {
        const body = await c.req.json<{ track_id?: unknown }>();
        trackId = validateTrackId(body.track_id);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    await c.env.DB.prepare(
        'INSERT INTO likes (user_id, track_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
    ).bind(user.id, trackId).run();

    return c.json({ ok: true });
});

likes.delete('/', async (c) => {
    const user = c.get('user')!;
    let trackId: number;
    try {
        const body = await c.req.json<{ track_id?: unknown }>();
        trackId = validateTrackId(body.track_id);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    await c.env.DB.prepare('DELETE FROM likes WHERE user_id = ? AND track_id = ?')
        .bind(user.id, trackId).run();

    return c.json({ ok: true });
});

export default likes;
