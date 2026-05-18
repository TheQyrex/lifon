import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { validateOptionalString, validationErrorResponse } from '../../lib/validation';

const supporters = new Hono<AppEnv>();

supporters.get('/', async (c) => {
    const rows = await c.env.DB.prepare(
        'SELECT id, name, handle, color, sort_order FROM supporters ORDER BY sort_order, id'
    ).all();
    return c.json({ ok: true, supporters: rows.results });
});

supporters.post('/', async (c) => {
    const body = await c.req.json<{ name?: unknown; handle?: unknown; color?: unknown }>().catch(() => null);
    if (!body) return c.json({ ok: false, error: 'bad_request' }, 400);

    let name: string, handle: string, color: string;
    try {
        name   = validateOptionalString('name',   body.name,   100) || '';
        handle = validateOptionalString('handle', body.handle, 100) || '';
        color  = validateOptionalString('color',  body.color,  20)  || '#8b5cf6';
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    if (!name || !handle) return c.json({ ok: false, error: 'invalid_input', message: 'name and handle required' }, 400);

    const maxOrder = await c.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM supporters').first<{ m: number }>();
    const sort_order = (maxOrder?.m ?? -1) + 1;

    const res = await c.env.DB.prepare(
        'INSERT INTO supporters (name, handle, color, sort_order) VALUES (?, ?, ?, ?) RETURNING id'
    ).bind(name, handle, color, sort_order).first<{ id: number }>();

    return c.json({ ok: true, id: res!.id });
});

supporters.put('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json<{ name?: unknown; handle?: unknown; color?: unknown }>().catch(() => null);
    if (!body) return c.json({ ok: false, error: 'bad_request' }, 400);

    let name: string, handle: string, color: string;
    try {
        name   = validateOptionalString('name',   body.name,   100) || '';
        handle = validateOptionalString('handle', body.handle, 100) || '';
        color  = validateOptionalString('color',  body.color,  20)  || '#8b5cf6';
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    if (!name || !handle) return c.json({ ok: false, error: 'invalid_input', message: 'name and handle required' }, 400);

    const info = await c.env.DB.prepare(
        'UPDATE supporters SET name=?, handle=?, color=? WHERE id=?'
    ).bind(name, handle, color, id).run();

    if (!info.meta.changes) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({ ok: true });
});

supporters.delete('/:id', async (c) => {
    const id = Number(c.req.param('id'));
    const info = await c.env.DB.prepare('DELETE FROM supporters WHERE id=?').bind(id).run();
    if (!info.meta.changes) return c.json({ ok: false, error: 'not_found' }, 404);
    return c.json({ ok: true });
});

supporters.patch('/reorder', async (c) => {
    const body = await c.req.json<{ items?: { id: number; sort_order: number }[] }>().catch(() => null);
    if (!body?.items?.length) return c.json({ ok: false, error: 'bad_request' }, 400);

    const stmt = c.env.DB.prepare('UPDATE supporters SET sort_order=? WHERE id=?');
    await c.env.DB.batch(body.items.map(({ id, sort_order }) => stmt.bind(sort_order, id)));

    return c.json({ ok: true });
});

export default supporters;
