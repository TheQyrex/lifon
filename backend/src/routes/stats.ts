import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';

const stats = new Hono<AppEnv>();

stats.use('*', requireAuth);

stats.get('/', async (c) => {
    const user = c.get('user')!;

    const top = await c.env.DB.prepare(
        `SELECT track_id, COUNT(*) AS play_count
         FROM listens
         WHERE user_id = ?
         GROUP BY track_id
         ORDER BY play_count DESC, MAX(created_at) DESC
         LIMIT 10`,
    ).bind(user.id).all<{ track_id: number; play_count: number }>();

    const total = await c.env.DB.prepare(
        'SELECT COUNT(*) AS total_listens, COALESCE(SUM(duration_ms), 0) AS total_ms FROM listens WHERE user_id = ?',
    ).bind(user.id).first<{ total_listens: number; total_ms: number }>();

    return c.json({
        ok: true,
        top_tracks: top.results,
        total_ms: total?.total_ms ?? 0,
        total_listens: total?.total_listens ?? 0,
    });
});

export default stats;
