import { Hono } from 'hono';
import type { AppEnv } from '../../env';

const stats = new Hono<AppEnv>();

stats.get('/', async (c) => {
    const since30d = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;

    const [usersTotal, usersActive, listensTotal, listensRecent, likesTotal, platformRows] = await Promise.all([
        c.env.DB.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= ?').bind(since30d).first<{ n: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(duration_ms), 0) AS ms FROM listens').first<{ n: number; ms: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) AS n FROM listens WHERE created_at >= ?').bind(since30d).first<{ n: number }>(),
        c.env.DB.prepare('SELECT COUNT(*) AS n FROM likes').first<{ n: number }>(),
        c.env.DB.prepare(
            `SELECT COALESCE(platform, 'web') AS platform, COUNT(*) AS n
             FROM listens GROUP BY COALESCE(platform, 'web')`
        ).all<{ platform: string; n: number }>(),
    ]);

    const topTracks = await c.env.DB.prepare(
        `SELECT l.track_id, t.title, t.artist, a.title AS album_title,
                COUNT(*) AS plays, COUNT(DISTINCT l.user_id) AS listeners
         FROM listens l
         LEFT JOIN tracks t ON t.id = l.track_id
         LEFT JOIN albums a ON a.id = t.album_id
         GROUP BY l.track_id, t.title, t.artist, a.title
         ORDER BY plays DESC
         LIMIT 20`,
    ).all<{ track_id: number; title: string | null; artist: string | null; album_title: string | null; plays: number; listeners: number }>();

    const topLiked = await c.env.DB.prepare(
        `SELECT l.track_id, t.title, t.artist, a.title AS album_title, COUNT(*) AS likes
         FROM likes l
         LEFT JOIN tracks t ON t.id = l.track_id
         LEFT JOIN albums a ON a.id = t.album_id
         GROUP BY l.track_id, t.title, t.artist, a.title
         ORDER BY likes DESC
         LIMIT 20`,
    ).all<{ track_id: number; title: string | null; artist: string | null; album_title: string | null; likes: number }>();

    const recentSignups = await c.env.DB.prepare(
        `SELECT id, username, created_at, last_seen_at, is_admin
         FROM users
         ORDER BY created_at DESC
         LIMIT 30`,
    ).all<{ id: number; username: string; created_at: number; last_seen_at: number | null; is_admin: number }>();

    const platformMap: Record<string, number> = {};
    for (const r of platformRows.results) platformMap[r.platform] = r.n;

    return c.json({
        ok: true,
        totals: {
            users: usersTotal?.n ?? 0,
            users_active_30d: usersActive?.n ?? 0,
            listens: listensTotal?.n ?? 0,
            listens_recent_30d: listensRecent?.n ?? 0,
            listen_ms: listensTotal?.ms ?? 0,
            likes: likesTotal?.n ?? 0,
            listens_by_platform: {
                web: platformMap['web'] ?? 0,
                android: platformMap['android'] ?? 0,
                ios: platformMap['ios'] ?? 0,
            },
        },
        top_tracks: topTracks.results,
        top_liked: topLiked.results,
        recent_users: recentSignups.results.map(u => ({
            id: u.id,
            username: u.username,
            created_at: u.created_at,
            last_seen_at: u.last_seen_at,
            is_admin: !!u.is_admin,
        })),
    });
});

export default stats;
