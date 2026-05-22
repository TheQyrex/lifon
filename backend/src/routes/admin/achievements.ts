import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { publicUrl } from '../../lib/r2';
import {
    validateNonEmptyString,
    validateOptionalString,
    ValidationError,
    validationErrorResponse,
} from '../../lib/validation';

const adminAchievements = new Hono<AppEnv>();

const VALID_TYPES = ['listens_total', 'unique_tracks', 'likes_total', 'manual'] as const;

adminAchievements.get('/', async (c) => {
    const rows = await c.env.DB.prepare(
        'SELECT id, name, description, icon_key, condition_type, condition_value, created_at FROM achievements ORDER BY condition_type, condition_value',
    ).all<{
        id: number; name: string; description: string; icon_key: string | null;
        condition_type: string; condition_value: number; created_at: number;
    }>();

    return c.json({
        ok: true,
        achievements: rows.results.map(a => ({
            ...a,
            icon_url: publicUrl(c.env, a.icon_key),
        })),
    });
});

adminAchievements.post('/', async (c) => {
    let name: string, description: string, iconKey: string | null | undefined;
    let conditionType: string, conditionValue: number;
    try {
        const body = await c.req.json<{
            name?: unknown; description?: unknown; icon_key?: unknown;
            condition_type?: unknown; condition_value?: unknown;
        }>();
        name = validateNonEmptyString('name', body.name, 200);
        description = validateOptionalString('description', body.description, 1000) ?? '';
        iconKey = validateOptionalString('icon_key', body.icon_key, 300);
        const ct = String(body.condition_type ?? '');
        if (!VALID_TYPES.includes(ct as typeof VALID_TYPES[number])) {
            throw new ValidationError('condition_type', `Допустимые значения: ${VALID_TYPES.join(', ')}`);
        }
        conditionType = ct;
        conditionValue = Math.max(0, Math.floor(Number(body.condition_value ?? 0)));
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const row = await c.env.DB.prepare(
        'INSERT INTO achievements (name, description, icon_key, condition_type, condition_value) VALUES (?, ?, ?, ?, ?) RETURNING id',
    ).bind(name, description, iconKey ?? null, conditionType, conditionValue).first<{ id: number }>();

    return c.json({ ok: true, id: row?.id });
});

adminAchievements.put('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    let name: string, description: string, iconKey: string | null | undefined;
    let conditionType: string, conditionValue: number;
    try {
        const body = await c.req.json<{
            name?: unknown; description?: unknown; icon_key?: unknown;
            condition_type?: unknown; condition_value?: unknown;
        }>();
        name = validateNonEmptyString('name', body.name, 200);
        description = validateOptionalString('description', body.description, 1000) ?? '';
        iconKey = body.icon_key === undefined ? undefined : validateOptionalString('icon_key', body.icon_key, 300);
        const ct = String(body.condition_type ?? '');
        if (!VALID_TYPES.includes(ct as typeof VALID_TYPES[number])) {
            throw new ValidationError('condition_type', `Допустимые значения: ${VALID_TYPES.join(', ')}`);
        }
        conditionType = ct;
        conditionValue = Math.max(0, Math.floor(Number(body.condition_value ?? 0)));
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const prev = await c.env.DB.prepare('SELECT icon_key FROM achievements WHERE id = ?')
        .bind(id).first<{ icon_key: string | null }>();
    if (!prev) return c.json({ ok: false, error: 'not_found' }, 404);

    const nextIconKey = iconKey === undefined ? prev.icon_key : iconKey;

    await c.env.DB.prepare(
        'UPDATE achievements SET name = ?, description = ?, icon_key = ?, condition_type = ?, condition_value = ? WHERE id = ?',
    ).bind(name, description, nextIconKey, conditionType, conditionValue, id).run();

    return c.json({ ok: true });
});

adminAchievements.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    await c.env.DB.prepare('DELETE FROM achievements WHERE id = ?').bind(id).run();
    return c.json({ ok: true });
});

// Manually award an achievement to a user
adminAchievements.post('/:id/award', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    let userId: number;
    try {
        const body = await c.req.json<{ user_id?: unknown }>();
        const u = Number(body.user_id);
        if (!Number.isInteger(u) || u <= 0) throw new ValidationError('user_id', 'user_id обязателен');
        userId = u;
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const achievement = await c.env.DB.prepare('SELECT id FROM achievements WHERE id = ?')
        .bind(id).first<{ id: number }>();
    if (!achievement) return c.json({ ok: false, error: 'not_found' }, 404);

    const result = await c.env.DB.prepare(
        'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
    ).bind(userId, id).run();

    if (result.meta.changes > 0) {
        await c.env.DB.prepare(
            'INSERT INTO achievement_notifications (user_id, achievement_id) VALUES (?, ?)',
        ).bind(userId, id).run();
    }

    return c.json({ ok: true, awarded: result.meta.changes > 0 });
});

export default adminAchievements;
