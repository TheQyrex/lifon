import type { D1Database } from '@cloudflare/workers-types';

type Trigger = 'listen' | 'like';

export async function checkAchievements(db: D1Database, userId: number, trigger: Trigger): Promise<void> {
    const triggerTypes = trigger === 'listen'
        ? ['listens_total', 'unique_tracks']
        : ['likes_total'];

    const placeholders = triggerTypes.map(() => '?').join(',');
    const candidates = await db.prepare(
        `SELECT id, condition_type, condition_value FROM achievements
         WHERE condition_type IN (${placeholders})
         AND id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = ?)`,
    ).bind(...triggerTypes, userId).all<{ id: number; condition_type: string; condition_value: number }>();

    if (candidates.results.length === 0) return;

    let listensTotal = 0, uniqueTracks = 0, likesTotal = 0;

    if (trigger === 'listen') {
        const row = await db.prepare(
            'SELECT COUNT(*) AS listens_total, COUNT(DISTINCT track_id) AS unique_tracks FROM listens WHERE user_id = ?',
        ).bind(userId).first<{ listens_total: number; unique_tracks: number }>();
        listensTotal = row?.listens_total ?? 0;
        uniqueTracks = row?.unique_tracks ?? 0;
    } else {
        const row = await db.prepare(
            'SELECT COUNT(*) AS likes_total FROM likes WHERE user_id = ?',
        ).bind(userId).first<{ likes_total: number }>();
        likesTotal = row?.likes_total ?? 0;
    }

    for (const a of candidates.results) {
        let earned = false;
        if (a.condition_type === 'listens_total' && listensTotal >= a.condition_value) earned = true;
        if (a.condition_type === 'unique_tracks' && uniqueTracks >= a.condition_value) earned = true;
        if (a.condition_type === 'likes_total'   && likesTotal   >= a.condition_value) earned = true;
        if (!earned) continue;

        const result = await db.prepare(
            'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        ).bind(userId, a.id).run();

        if (result.meta.changes > 0) {
            await db.prepare(
                'INSERT INTO achievement_notifications (user_id, achievement_id) VALUES (?, ?)',
            ).bind(userId, a.id).run();
        }
    }
}
