import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { verifyJwt } from './crypto';

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
    const user = await resolveUser(c);
    if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
    c.set('user', user);
    await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
    const user = await resolveUser(c);
    if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401);
    if (!user.isAdmin) return c.json({ ok: false, error: 'forbidden' }, 403);
    c.set('user', user);
    await next();
};

async function resolveUser(c: Context<AppEnv>) {
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
