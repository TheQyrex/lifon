import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv, AuthedUser, Env } from '../env';
import { verifyJwt } from './crypto';

export interface MaintenanceState {
    enabled: boolean;
    message: string;
}

const DEFAULT_MESSAGE = 'Сайт находится на технических работах';
const DEFAULT_STATE: MaintenanceState = { enabled: false, message: DEFAULT_MESSAGE };

export async function getMaintenanceState(db: D1Database): Promise<MaintenanceState> {
    try {
        const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?')
            .bind('maintenance')
            .first<{ value: string }>();
        if (!row?.value) return DEFAULT_STATE;

        const parsed = JSON.parse(row.value) as Partial<MaintenanceState>;
        return {
            enabled: parsed.enabled === true,
            message: typeof parsed.message === 'string' && parsed.message.trim()
                ? parsed.message.trim().slice(0, 240)
                : DEFAULT_MESSAGE,
        };
    } catch {
        return DEFAULT_STATE;
    }
}

export async function setMaintenanceState(
    env: Env,
    state: MaintenanceState,
    updatedBy: number | null,
): Promise<void> {
    const next: MaintenanceState = {
        enabled: state.enabled === true,
        message: state.message.trim() || DEFAULT_MESSAGE,
    };

    await env.DB.prepare(
        `INSERT INTO app_settings (key, value, updated_at, updated_by)
         VALUES ('maintenance', ?, unixepoch(), ?)
         ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at,
             updated_by = excluded.updated_by`,
    ).bind(JSON.stringify(next), updatedBy).run();
}

export const maintenanceGate: MiddlewareHandler<AppEnv> = async (c, next) => {
    if (c.req.method === 'OPTIONS') {
        await next();
        return;
    }

    const state = await getMaintenanceState(c.env.DB);
    if (!state.enabled) {
        await next();
        return;
    }

    if (c.req.path === '/auth/login') {
        await next();
        return;
    }

    const user = await resolveMaintenanceUser(c);
    if (user?.isAdmin) {
        c.set('user', user);
        await next();
        return;
    }

    return c.json({ ok: false, error: 'maintenance', message: state.message }, 503);
};

async function resolveMaintenanceUser(c: Context<AppEnv>): Promise<AuthedUser | null> {
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    if (!token) return null;

    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) return null;

    return {
        id: payload.sub,
        username: payload.name,
        isAdmin: payload.adm === 1,
    };
}
