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
    telegram_id: number | null;
}

const auth = new Hono<AppEnv>();

auth.post('/register', async (c) => {
    return c.json({ ok: false, error: 'registration_disabled', message: 'Регистрация доступна только через Telegram' }, 403);

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
        'SELECT id, username, password_hash, password_salt, password_iter, is_admin, telegram_id FROM users WHERE username = ?',
    ).bind(username).first<UserRow>();

    // Telegram-only account — no password was ever set
    if (user && user.password_iter === 0) {
        return c.json({ ok: false, error: 'telegram_only', message: 'Этот аккаунт входит через Telegram' }, 403);
    }

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

auth.post('/telegram', async (c) => {
    const limit = await rateLimit(c.env, `tg:${clientIp(c.req.raw)}`, 20, 5 * 60);
    if (!limit.ok) return c.json({ ok: false, error: 'rate_limited' }, 429);

    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return c.json({ ok: false, error: 'server_error', message: 'Telegram вход не настроен' }, 500);

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ ok: false, error: 'bad_request' }, 400);
    }

    const { hash, ...rawData } = body;
    if (typeof hash !== 'string') return c.json({ ok: false, error: 'invalid_data' }, 400);

    // auth_date должен быть не старше 24 часов
    const authDate = Number(rawData.auth_date);
    if (!authDate || Date.now() / 1000 - authDate > 86400) {
        return c.json({ ok: false, error: 'auth_expired', message: 'Данные устарели, попробуй ещё раз' }, 400);
    }

    // data-check-string: все поля кроме hash, отсортированные по ключу, через \n
    const dataCheckString = Object.keys(rawData)
        .filter(k => rawData[k] !== undefined && rawData[k] !== null)
        .sort()
        .map(k => `${k}=${rawData[k]}`)
        .join('\n');

    // secret_key = SHA256(bot_token), затем HMAC-SHA256(dataCheckString, secret_key)
    const enc = new TextEncoder();
    const secretKeyRaw = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
    const hmacKey = await crypto.subtle.importKey('raw', secretKeyRaw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const expectedHash = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (expectedHash !== hash) return c.json({ ok: false, error: 'invalid_hash', message: 'Ошибка верификации Telegram' }, 401);

    const telegramId = Number(rawData.id);
    if (!telegramId || !Number.isFinite(telegramId)) return c.json({ ok: false, error: 'invalid_data' }, 400);

    // Ищем существующего пользователя по telegram_id
    const existing = await c.env.DB.prepare(
        'SELECT id, username, is_admin FROM users WHERE telegram_id = ?',
    ).bind(telegramId).first<{ id: number; username: string; is_admin: number }>();

    if (existing) {
        const maintenance = await getMaintenanceState(c.env.DB);
        if (maintenance.enabled && !existing.is_admin) {
            return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
        }
        await c.env.DB.prepare('UPDATE users SET last_seen_at = unixepoch() WHERE id = ?').bind(existing.id).run();
        const token = await signJwt(
            { sub: existing.id, name: existing.username, adm: existing.is_admin ? 1 : 0 },
            c.env.JWT_SECRET,
        );
        return c.json({ ok: true, token, user: { id: existing.id, username: existing.username, is_admin: !!existing.is_admin } });
    }

    // Новый пользователь — регистрация через Telegram
    const maintenance = await getMaintenanceState(c.env.DB);
    if (maintenance.enabled) {
        return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
    }

    // Генерируем username из Telegram-хендла или fallback tg_<id>
    const rawTgName = typeof rawData.username === 'string' ? rawData.username : '';
    const cleaned = rawTgName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    let username = cleaned.length >= 3 ? cleaned : `tg_${telegramId}`;

    const taken = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
    if (taken) username = `tg_${telegramId}`;

    // Telegram-пользователи хранятся без пароля (password_iter=0 — признак Telegram-аккаунта)
    const inserted = await c.env.DB.prepare(
        'INSERT INTO users (username, password_hash, password_salt, password_iter, telegram_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
    ).bind(username, '', '', 0, telegramId).first<{ id: number }>();

    if (!inserted) return c.json({ ok: false, error: 'server_error' }, 500);

    const token = await signJwt({ sub: inserted.id, name: username, adm: 0 }, c.env.JWT_SECRET);
    return c.json({ ok: true, token, user: { id: inserted.id, username, is_admin: false } });
});

export default auth;
