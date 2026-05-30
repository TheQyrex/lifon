// Strict input validation. Returns the normalised value or throws a ValidationError.

import type { Context } from 'hono';

export class ValidationError extends Error {
    constructor(public readonly field: string, message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

/**
 * Унифицированный helper для возврата 400 в ответ на ValidationError или unknown bad request.
 * Использовать в catch-блоках роутов после `validate*`.
 */
export function validationErrorResponse(c: Context, err: unknown) {
    if (err instanceof ValidationError) {
        return c.json({ ok: false, error: 'invalid_input', field: err.field, message: err.message }, 400);
    }
    return c.json({ ok: false, error: 'bad_request' }, 400);
}

const USERNAME_RE = /^[\p{L}\p{N}._#-]{3,24}$/u;

export function validateUsername(raw: unknown): string {
    if (typeof raw !== 'string') throw new ValidationError('username', 'Имя должно быть строкой');
    const value = raw.trim().toLowerCase();
    if (!USERNAME_RE.test(value)) {
        throw new ValidationError('username', 'Имя: 3–24 символа, буквы/цифры/._#-');
    }
    return value;
}

export function validatePassword(raw: unknown): string {
    if (typeof raw !== 'string') throw new ValidationError('password', 'Пароль должен быть строкой');
    if (raw.length < 8) throw new ValidationError('password', 'Пароль слишком короткий (минимум 8)');
    if (raw.length > 200) throw new ValidationError('password', 'Пароль слишком длинный');
    return raw;
}

/**
 * Строгая проверка для регистрации новых аккаунтов. Старым юзерам со слабыми паролями
 * вход не ломает, но новых заставляет придерживаться нормальных требований.
 */
export function validateStrongPassword(raw: unknown): string {
    const value = validatePassword(raw);
    if (value.length < 12) throw new ValidationError('password', 'Пароль слишком короткий (минимум 12)');
    if (!/[a-zA-Zа-яА-Я]/.test(value)) throw new ValidationError('password', 'Пароль должен содержать хотя бы одну букву');
    if (!/\d/.test(value)) throw new ValidationError('password', 'Пароль должен содержать хотя бы одну цифру');
    return value;
}

export function validateTrackId(raw: unknown): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) {
        throw new ValidationError('track_id', 'Некорректный track_id');
    }
    return n;
}

export function validateDurationMs(raw: unknown): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 60 * 60 * 1000) {
        throw new ValidationError('duration_ms', 'Длительность вне диапазона');
    }
    return Math.floor(n);
}

export function validateNonEmptyString(field: string, raw: unknown, max = 500): string {
    if (typeof raw !== 'string') throw new ValidationError(field, `${field}: ожидается строка`);
    const value = raw.trim();
    if (!value) throw new ValidationError(field, `${field}: пусто`);
    if (value.length > max) throw new ValidationError(field, `${field}: слишком длинно`);
    return value;
}

export function validateOptionalString(field: string, raw: unknown, max = 5000): string | null {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw !== 'string') throw new ValidationError(field, `${field}: ожидается строка`);
    if (raw.length > max) throw new ValidationError(field, `${field}: слишком длинно`);
    return raw;
}

export function validateBroadcastKind(raw: unknown): 'notification' | 'banner' {
    if (raw === 'notification' || raw === 'banner') return raw;
    throw new ValidationError('kind', 'kind: ожидается "notification" или "banner"');
}
