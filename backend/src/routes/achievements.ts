import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { publicUrl } from '../lib/r2';

const achievements = new Hono<AppEnv>();

// Public: list all achievements (for profile display, sorted by condition_value)
achievements.get('/', async (c) => {
    const rows = await c.env.DB.prepare(
        'SELECT id, name, description, icon_key, condition_type, condition_value FROM achievements ORDER BY condition_type, condition_value',
    ).all<{ id: number; name: string; description: string; icon_key: string | null; condition_type: string; condition_value: number }>();

    return c.json({
        ok: true,
        achievements: rows.results.map(a => ({
            ...a,
            icon_url: publicUrl(c.env, a.icon_key),
        })),
    });
});

achievements.use('*', requireAuth);

// Get current user's earned achievements
achievements.get('/my', async (c) => {
    const user = c.get('user')!;
    const rows = await c.env.DB.prepare(
        `SELECT a.id, a.name, a.description, a.icon_key, a.condition_type, a.condition_value, ua.earned_at
         FROM user_achievements ua
         JOIN achievements a ON a.id = ua.achievement_id
         WHERE ua.user_id = ?
         ORDER BY ua.earned_at DESC`,
    ).bind(user.id).all<{
        id: number; name: string; description: string; icon_key: string | null;
        condition_type: string; condition_value: number; earned_at: number;
    }>();

    return c.json({
        ok: true,
        achievements: rows.results.map(a => ({
            ...a,
            icon_url: publicUrl(c.env, a.icon_key),
        })),
    });
});

// Get unread achievement notifications
achievements.get('/notifications', async (c) => {
    const user = c.get('user')!;
    const rows = await c.env.DB.prepare(
        `SELECT n.id, n.achievement_id, n.created_at,
                a.name, a.description, a.icon_key, ua.earned_at
         FROM achievement_notifications n
         JOIN achievements a ON a.id = n.achievement_id
         JOIN user_achievements ua ON ua.user_id = n.user_id AND ua.achievement_id = n.achievement_id
         WHERE n.user_id = ? AND n.read = 0
         ORDER BY n.created_at ASC`,
    ).bind(user.id).all<{
        id: number; achievement_id: number; created_at: number;
        name: string; description: string; icon_key: string | null; earned_at: number;
    }>();

    return c.json({
        ok: true,
        notifications: rows.results.map(n => ({
            ...n,
            icon_url: publicUrl(c.env, n.icon_key),
        })),
    });
});

// Mark all notifications as read
achievements.post('/notifications/read', async (c) => {
    const user = c.get('user')!;
    await c.env.DB.prepare(
        'UPDATE achievement_notifications SET read = 1 WHERE user_id = ? AND read = 0',
    ).bind(user.id).run();
    return c.json({ ok: true });
});

export default achievements;
