import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { validateDurationMs, validateTrackId, validationErrorResponse } from '../lib/validation';

const listens = new Hono<AppEnv>();

// «Сколько слушают сейчас» — публично, без auth. Активной считается сессия с heartbeat
// за последние LIVE_WINDOW секунд.
const LIVE_WINDOW = 60;

listens.get('/live', async (c) => {
    const since = Math.floor(Date.now() / 1000) - LIVE_WINDOW;
    const trackParam = c.req.query('track_id');

    if (trackParam) {
        const trackId = Number(trackParam);
        if (!Number.isInteger(trackId) || trackId <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);
        const row = await c.env.DB.prepare(
            'SELECT COUNT(*) AS n FROM live_sessions WHERE track_id = ? AND updated_at >= ?',
        ).bind(trackId, since).first<{ n: number }>();
        return c.json({ ok: true, count: row?.n ?? 0 });
    }

    const row = await c.env.DB.prepare(
        'SELECT COUNT(*) AS n FROM live_sessions WHERE updated_at >= ?',
    ).bind(since).first<{ n: number }>();
    return c.json({ ok: true, count: row?.n ?? 0 });
});

// Полная карта { track_id → count } для всех треков, где сейчас кто-то слушает.
// Используется библиотекой и экраном альбома, чтобы рисовать беджи без N запросов.
listens.get('/live/all', async (c) => {
    const since = Math.floor(Date.now() / 1000) - LIVE_WINDOW;
    const rows = await c.env.DB.prepare(
        'SELECT track_id, COUNT(*) AS n FROM live_sessions WHERE updated_at >= ? GROUP BY track_id',
    ).bind(since).all<{ track_id: number; n: number }>();
    const tracks: Record<number, number> = {};
    let total = 0;
    for (const r of rows.results) {
        tracks[r.track_id] = r.n;
        total += r.n;
    }
    return c.json({ ok: true, tracks, total });
});

listens.use('*', requireAuth);

listens.post('/heartbeat', async (c) => {
    const user = c.get('user')!;
    let trackId: number;
    try {
        const body = await c.req.json<{ track_id?: unknown }>();
        trackId = validateTrackId(body.track_id);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    await c.env.DB.prepare(
        `INSERT INTO live_sessions (user_id, track_id, updated_at)
         VALUES (?, ?, unixepoch())
         ON CONFLICT(user_id) DO UPDATE SET
             track_id = excluded.track_id,
             updated_at = excluded.updated_at`,
    ).bind(user.id, trackId).run();

    return c.json({ ok: true });
});

listens.post('/', async (c) => {
    const user = c.get('user')!;
    let trackId: number;
    let durationMs: number;
    try {
        const body = await c.req.json<{ track_id?: unknown; duration_ms?: unknown }>();
        trackId = validateTrackId(body.track_id);
        durationMs = validateDurationMs(body.duration_ms);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    // Don't record blip-ish "listens" (e.g. accidentally skipped tracks).
    if (durationMs < 1000) return c.json({ ok: true, recorded: false });

    await c.env.DB.prepare(
        'INSERT INTO listens (user_id, track_id, duration_ms) VALUES (?, ?, ?)',
    ).bind(user.id, trackId, durationMs).run();

    return c.json({ ok: true, recorded: true });
});

export default listens;
