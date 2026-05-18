import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { getMaintenanceState, setMaintenanceState } from '../../lib/maintenance';
import { validateOptionalString, validationErrorResponse } from '../../lib/validation';

const maintenance = new Hono<AppEnv>();

maintenance.get('/', async (c) => {
    const state = await getMaintenanceState(c.env.DB);
    return c.json({ ok: true, maintenance: state });
});

maintenance.put('/', async (c) => {
    const user = c.get('user')!;
    const body = await c.req.json<{ enabled?: unknown; message?: unknown }>().catch(() => null);
    if (!body) return c.json({ ok: false, error: 'bad_request' }, 400);

    let message: string;
    try {
        message = validateOptionalString('message', body.message, 240) || 'Сайт находится на технических работах';
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const enabled = body.enabled === true;
    await setMaintenanceState(c.env, { enabled, message }, user.id);

    return c.json({ ok: true, maintenance: { enabled, message } });
});

export default maintenance;
