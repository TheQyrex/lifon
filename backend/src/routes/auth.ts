import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { hashPassword, signJwt, verifyPassword } from '../lib/crypto';
import { clientIp, rateLimit } from '../lib/ratelimit';
import { validatePassword, validateStrongPassword, validateUsername, validationErrorResponse } from '../lib/validation';
import { getMaintenanceState } from '../lib/maintenance';
import { requireAuth } from '../lib/auth';

interface UserRow {
    id: number;
    username: string;
    password_hash: string;
    password_salt: string;
    password_iter: number;
    is_admin: number;
    telegram_id: number | null;
    require_telegram: number;
}

const auth = new Hono<AppEnv>();

// Верификация подписи от Telegram Login Widget.
// secret_key = SHA256(bot_token), hash = HMAC-SHA256(data_check_string, secret_key)
async function verifyTelegramHash(rawData: Record<string, unknown>, hash: string, botToken: string): Promise<boolean> {
    const dataCheckString = Object.keys(rawData)
        .filter(k => rawData[k] !== undefined && rawData[k] !== null)
        .sort()
        .map(k => `${k}=${rawData[k]}`)
        .join('\n');

    const enc = new TextEncoder();
    const secretKeyRaw = await crypto.subtle.digest('SHA-256', enc.encode(botToken));
    const hmacKey = await crypto.subtle.importKey('raw', secretKeyRaw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(dataCheckString));
    const expectedHash = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return expectedHash === hash;
}

auth.post('/register', async (c) => {
    return c.json({ ok: false, error: 'registration_disabled', message: 'Регистрация доступна только через Telegram' }, 403);
});

auth.post('/login', async (c) => {
    const ip = clientIp(c.req.raw);
    const limit = await rateLimit(c.env, `login:${ip}`, 10, 5 * 60);
    if (!limit.ok) return c.json({ ok: false, error: 'rate_limited' }, 429);

    let username: string;
    let password: string | null;
    try {
        const body = await c.req.json<{ username?: unknown; password?: unknown }>();
        username = validateUsername(body.username);
        // password необязателен — пустая строка или отсутствие = шаг 1 (проверка username)
        const rawPw = body.password;
        password = (typeof rawPw === 'string' && rawPw.length > 0)
            ? validatePassword(rawPw)
            : null;
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const user = await c.env.DB.prepare(
        'SELECT id, username, password_hash, password_salt, password_iter, is_admin, telegram_id, require_telegram FROM users WHERE username = ?',
    ).bind(username).first<UserRow>();

    if (!user) {
        // Timing-safe: скрываем факт существования username
        if (password) {
            await verifyPassword(password, {
                hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                salt: 'AAAAAAAAAAAAAAAAAAAAAA',
                iterations: 100_000,
            }).catch(() => false);
        }
        return c.json({ ok: false, error: 'invalid_credentials' }, 401);
    }

    // Пользователь без пароля (password_iter = 0)
    if (user.password_iter === 0) {
        // Аккаунт с Telegram без пароля — только Telegram-вход
        if (user.telegram_id && !password) {
            return c.json({ ok: false, error: 'telegram_only', message: 'Этот аккаунт входит через Telegram' }, 403);
        }

        if (!password) {
            // Шаг 1: пароль не задан → просим пользователя придумать новый
            return c.json({ ok: true, needs_password: true });
        }

        // Шаг 2: пользователь придумал новый пароль → сохраняем и выдаём токен
        const maintenance = await getMaintenanceState(c.env.DB);
        if (maintenance.enabled && !user.is_admin) {
            return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
        }
        const { hash, salt, iterations } = await hashPassword(password);
        await c.env.DB.prepare(
            'UPDATE users SET password_hash = ?, password_salt = ?, password_iter = ?, last_seen_at = unixepoch() WHERE id = ?',
        ).bind(hash, salt, iterations, user.id).run();
        const firstToken = await signJwt(
            { sub: user.id, name: user.username, adm: user.is_admin ? 1 : 0 },
            c.env.JWT_SECRET,
        );
        return c.json({
            ok: true,
            token: firstToken,
            user: {
                id: user.id,
                username: user.username,
                is_admin: !!user.is_admin,
                telegram_id: user.telegram_id,
                require_telegram: !!user.require_telegram,
            },
        });
    }

    // Обычный вход с паролем
    if (!password) {
        // Пользователь уже имеет пароль, но не прислал его — просим ввести
        return c.json({ ok: false, error: 'password_required' }, 400);
    }

    // Per-username lockout — только для аккаунтов с паролем, только при неудачах
    const windowSec = 15 * 60;
    const bucket = Math.floor(Date.now() / 1000 / windowSec);
    const lockoutKvKey = `rl:login:fail:${username}:${bucket}`;
    const failRaw = await c.env.RATELIMIT.get(lockoutKvKey).catch(() => null);
    const failCount = failRaw ? parseInt(failRaw, 10) || 0 : 0;
    if (failCount >= 5) {
        return c.json({ ok: false, error: 'account_locked', message: 'Слишком много попыток. Попробуйте позже.' }, 429);
    }

    const ok = await verifyPassword(password, {
        hash: user.password_hash,
        salt: user.password_salt,
        iterations: user.password_iter,
    });
    if (!ok) {
        await c.env.RATELIMIT.put(lockoutKvKey, String(failCount + 1), { expirationTtl: windowSec + 5 }).catch(() => {});
        return c.json({ ok: false, error: 'invalid_credentials' }, 401);
    }

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
        user: {
            id: user.id,
            username: user.username,
            is_admin: !!user.is_admin,
            telegram_id: user.telegram_id,
            require_telegram: !!user.require_telegram,
        },
    });
});

// Шаг 1: верифицируем данные от Telegram.
// Существующий пользователь → сразу JWT.
// Новый пользователь → pending: true, предлагаем ник для следующего шага.
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

    const authDate = Number(rawData.auth_date);
    if (!authDate || Date.now() / 1000 - authDate > 86400) {
        return c.json({ ok: false, error: 'auth_expired', message: 'Данные устарели, попробуй ещё раз' }, 400);
    }

    if (!(await verifyTelegramHash(rawData, hash, botToken))) {
        return c.json({ ok: false, error: 'invalid_hash', message: 'Ошибка верификации Telegram' }, 401);
    }

    const telegramId = Number(rawData.id);
    if (!telegramId || !Number.isFinite(telegramId)) return c.json({ ok: false, error: 'invalid_data' }, 400);

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
        return c.json({ ok: true, pending: false, token, user: { id: existing.id, username: existing.username, is_admin: !!existing.is_admin } });
    }

    const maintenance = await getMaintenanceState(c.env.DB);
    if (maintenance.enabled) {
        return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
    }

    // Предлагаем ник на основе Telegram-хендла, но не создаём аккаунт
    const rawTgName = typeof rawData.username === 'string' ? rawData.username : '';
    const cleaned = rawTgName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    let suggestedUsername = cleaned.length >= 3 ? cleaned : `tg_${telegramId}`;

    const taken = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(suggestedUsername).first();
    if (taken) suggestedUsername = `tg_${telegramId}`;

    return c.json({ ok: true, pending: true, suggested_username: suggestedUsername });
});

// Шаг 2: пользователь выбрал ник и пароль — создаём аккаунт.
// Для безопасности повторно верифицируем Telegram-данные.
auth.post('/telegram/complete', async (c) => {
    const limit = await rateLimit(c.env, `tg_complete:${clientIp(c.req.raw)}`, 10, 15 * 60);
    if (!limit.ok) return c.json({ ok: false, error: 'rate_limited' }, 429);

    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return c.json({ ok: false, error: 'server_error' }, 500);

    let tgData: Record<string, unknown>;
    let username: string;
    let password: string;
    try {
        const body = await c.req.json<{ tg_data?: unknown; username?: unknown; password?: unknown }>();
        if (!body.tg_data || typeof body.tg_data !== 'object' || Array.isArray(body.tg_data)) {
            return c.json({ ok: false, error: 'bad_request' }, 400);
        }
        tgData = body.tg_data as Record<string, unknown>;
        username = validateUsername(body.username);
        password = validateStrongPassword(body.password);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const { hash, ...rawData } = tgData;
    if (typeof hash !== 'string') return c.json({ ok: false, error: 'invalid_data' }, 400);

    const authDate = Number(rawData.auth_date);
    if (!authDate || Date.now() / 1000 - authDate > 86400) {
        return c.json({ ok: false, error: 'auth_expired', message: 'Данные устарели, начни заново' }, 400);
    }

    if (!(await verifyTelegramHash(rawData, hash, botToken))) {
        return c.json({ ok: false, error: 'invalid_hash', message: 'Ошибка верификации Telegram' }, 401);
    }

    const telegramId = Number(rawData.id);
    if (!telegramId || !Number.isFinite(telegramId)) return c.json({ ok: false, error: 'invalid_data' }, 400);

    const existingTg = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_id = ?').bind(telegramId).first();
    if (existingTg) return c.json({ ok: false, error: 'already_registered', message: 'Этот Telegram уже привязан к аккаунту' }, 409);

    const taken = await c.env.DB.prepare(
        'SELECT id, password_iter, telegram_id FROM users WHERE username = ?',
    ).bind(username).first<{ id: number; password_iter: number; telegram_id: number | null }>();

    if (taken) {
        // Если аккаунт мигрированный (password_iter=0 и telegram_id не установлен) —
        // позволяем «забрать» его: привязываем TG и устанавливаем новый пароль.
        if (taken.password_iter === 0 && taken.telegram_id === null) {
            const maintenance = await getMaintenanceState(c.env.DB);
            if (maintenance.enabled) {
                return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
            }
            const { hash: pwHash, salt, iterations } = await hashPassword(password);
            await c.env.DB.prepare(
                'UPDATE users SET telegram_id = ?, password_hash = ?, password_salt = ?, password_iter = ?, require_telegram = 0 WHERE id = ?',
            ).bind(telegramId, pwHash, salt, iterations, taken.id).run();
            await c.env.DB.prepare('UPDATE users SET last_seen_at = unixepoch() WHERE id = ?').bind(taken.id).run();
            const token = await signJwt({ sub: taken.id, name: username, adm: 0 }, c.env.JWT_SECRET);
            return c.json({ ok: true, token, user: { id: taken.id, username, is_admin: false }, claimed: true });
        }
        return c.json({ ok: false, error: 'username_taken', message: 'Это имя уже занято' }, 409);
    }

    const maintenance = await getMaintenanceState(c.env.DB);
    if (maintenance.enabled) {
        return c.json({ ok: false, error: 'maintenance', message: maintenance.message }, 503);
    }

    const { hash: pwHash, salt, iterations } = await hashPassword(password);

    const inserted = await c.env.DB.prepare(
        'INSERT INTO users (username, password_hash, password_salt, password_iter, telegram_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
    ).bind(username, pwHash, salt, iterations, telegramId).first<{ id: number }>();

    if (!inserted) return c.json({ ok: false, error: 'server_error' }, 500);

    const token = await signJwt({ sub: inserted.id, name: username, adm: 0 }, c.env.JWT_SECRET);
    return c.json({ ok: true, token, user: { id: inserted.id, username, is_admin: false } });
});

// Привязка Telegram к уже существующему аккаунту (вошедший пользователь без TG).
auth.post('/telegram/link', requireAuth, async (c) => {
    const limit = await rateLimit(c.env, `tg_link:${clientIp(c.req.raw)}`, 10, 5 * 60);
    if (!limit.ok) return c.json({ ok: false, error: 'rate_limited' }, 429);

    const botToken = c.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return c.json({ ok: false, error: 'server_error' }, 500);

    let body: Record<string, unknown>;
    try {
        body = await c.req.json();
    } catch {
        return c.json({ ok: false, error: 'bad_request' }, 400);
    }

    const { hash, ...rawData } = body;
    if (typeof hash !== 'string') return c.json({ ok: false, error: 'invalid_data' }, 400);

    const authDate = Number(rawData.auth_date);
    if (!authDate || Date.now() / 1000 - authDate > 86400) {
        return c.json({ ok: false, error: 'auth_expired', message: 'Данные устарели, попробуй ещё раз' }, 400);
    }

    if (!(await verifyTelegramHash(rawData, hash, botToken))) {
        return c.json({ ok: false, error: 'invalid_hash', message: 'Ошибка верификации Telegram' }, 401);
    }

    const telegramId = Number(rawData.id);
    if (!telegramId || !Number.isFinite(telegramId)) return c.json({ ok: false, error: 'invalid_data' }, 400);

    const already = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_id = ?').bind(telegramId).first();
    if (already) return c.json({ ok: false, error: 'already_linked', message: 'Этот Telegram уже привязан к другому аккаунту' }, 409);

    const me = c.get('user')!;
    await c.env.DB.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').bind(telegramId, me.id).run();

    return c.json({ ok: true, telegram_id: telegramId });
});

export default auth;
