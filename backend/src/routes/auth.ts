import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { hashPassword, signJwt, verifyPassword } from '../lib/crypto';
import { clientIp, rateLimit } from '../lib/ratelimit';
import { validatePassword, validateStrongPassword, validateUsername, validationErrorResponse } from '../lib/validation';
import { getMaintenanceState } from '../lib/maintenance';

interface UserRow {
    id: number;
    username: string;
    password_hash: string;
    password_salt: string;
    password_iter: number;
    is_admin: number;
}

const auth = new Hono<AppEnv>();

auth.post('/register', async (c) => {
    const maintenance = await getMaintenanceState(c.env.DB);
    if (maintenance.enabled) {
        return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
    }

    const limit = await rateLimit(c.env, `register:${clientIp(c.req.raw)}`, 5, 60 * 60);
    if (!limit.ok) return c.json({ ok: false, error: 'rate_limited' }, 429);

    let username: string;
    let password: string;
    try {
        const body = await c.req.json<{ username?: unknown; password?: unknown }>();
        username = validateUsername(body.username);
        password = validateStrongPassword(body.password);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?')
        .bind(username)
        .first<{ id: number }>();
    if (existing) return c.json({ ok: false, error: 'username_taken' }, 409);

    const { hash, salt, iterations } = await hashPassword(password);

    // Bootstrap-админ работает только когда в системе ещё нет ни одного админа.
    // Это закрывает дыру: если бы кто-то узнал ADMIN_BOOTSTRAP и админ был удалён,
    // регистрация под этим именем дала бы права. Теперь — только первый.
    let isBootstrapAdmin: 0 | 1 = 0;
    if (c.env.ADMIN_BOOTSTRAP && username === c.env.ADMIN_BOOTSTRAP.toLowerCase()) {
        const adminExists = await c.env.DB.prepare('SELECT 1 FROM users WHERE is_admin = 1 LIMIT 1').first<{ '1': number }>();
        if (!adminExists) isBootstrapAdmin = 1;
    }

    const inserted = await c.env.DB.prepare(
        'INSERT INTO users (username, password_hash, password_salt, password_iter, is_admin) VALUES (?, ?, ?, ?, ?) RETURNING id',
    ).bind(username, hash, salt, iterations, isBootstrapAdmin).first<{ id: number }>();

    if (!inserted) return c.json({ ok: false, error: 'server_error' }, 500);

    const token = await signJwt(
        { sub: inserted.id, name: username, adm: isBootstrapAdmin as 0 | 1 },
        c.env.JWT_SECRET,
    );

    return c.json({ ok: true, token, user: { id: inserted.id, username, is_admin: !!isBootstrapAdmin } });
});

auth.post('/login', async (c) => {
    const ip = clientIp(c.req.raw);
    const limit = await rateLimit(c.env, `login:${ip}`, 10, 5 * 60);
    if (!limit.ok) return c.json({ ok: false, error: 'rate_limited' }, 429);

    let username: string;
    let password: string;
    try {
        const body = await c.req.json<{ username?: unknown; password?: unknown }>();
        username = validateUsername(body.username);
        password = validatePassword(body.password);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    // Per-username lockout: даже если у атакера много IP, на один аккаунт даём всего
    // 5 неудачных попыток в 15 минут. Это блокирует распределённый brute-force.
    const lockoutKey = `login:fail:${username}`;
    const failCheck = await rateLimit(c.env, lockoutKey, 5, 15 * 60);
    if (!failCheck.ok) return c.json({ ok: false, error: 'account_locked', message: 'Слишком много попыток. Попробуйте позже.' }, 429);

    const user = await c.env.DB.prepare(
        'SELECT id, username, password_hash, password_salt, password_iter, is_admin FROM users WHERE username = ?',
    ).bind(username).first<UserRow>();

    // Constant-time-ish: still run a dummy PBKDF2 when the user is missing
    // so timing doesn't leak whether the username exists.
    if (!user) {
        await verifyPassword(password, {
            hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            salt: 'AAAAAAAAAAAAAAAAAAAAAA',
            iterations: 100_000,
        }).catch(() => false);
        return c.json({ ok: false, error: 'invalid_credentials' }, 401);
    }

    const ok = await verifyPassword(password, {
        hash: user.password_hash,
        salt: user.password_salt,
        iterations: user.password_iter,
    });
    if (!ok) return c.json({ ok: false, error: 'invalid_credentials' }, 401);

    const maintenance = await getMaintenanceState(c.env.DB);
    if (maintenance.enabled && !user.is_admin) {
        return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
    }

    await c.env.DB.prepare('UPDATE users SET last_seen_at = unixepoch() WHERE id = ?').bind(user.id).run();

    const token = await signJwt(
        { sub: user.id, name: user.username, adm: user.is_admin ? 1 : 0 },
        c.env.JWT_SECRET,
    );

    return c.json({
        ok: true,
        token,
        user: { id: user.id, username: user.username, is_admin: !!user.is_admin },
    });
});

export default auth;
