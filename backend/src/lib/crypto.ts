// Password hashing (PBKDF2-HMAC-SHA256) and JWT signing (HS256).
// Both implementations rely on the platform Web Crypto API — no external deps.

// OWASP 2024 рекомендация для PBKDF2-SHA256. Старые пароли (iterations хранятся per-user)
// продолжают работать со своим значением — увеличение влияет только на новые регистрации.
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_LEN = 32;          // 256-bit derived key
const SALT_LEN = 16;                // 128-bit random salt

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(input: string): Uint8Array {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
    const binary = atob(input.replace(/-/g, '+').replace(/_/g, '/') + pad);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export interface PasswordRecord {
    hash: string;
    salt: string;
    iterations: number;
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
    return {
        hash: toBase64Url(hash),
        salt: toBase64Url(salt),
        iterations: PBKDF2_ITERATIONS,
    };
}

export async function verifyPassword(
    password: string,
    record: PasswordRecord,
): Promise<boolean> {
    const salt = fromBase64Url(record.salt);
    const expected = fromBase64Url(record.hash);
    const candidate = await pbkdf2(password, salt, record.iterations);
    return timingSafeEqual(new Uint8Array(candidate), expected);
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits'],
    );
    return crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        key,
        PBKDF2_KEY_LEN * 8,
    );
}

// ----- JWT (HS256) -----

export interface JwtPayload {
    sub: number;         // user id
    name: string;        // username
    adm: 0 | 1;          // is_admin flag
    iat: number;         // issued at (unix s)
    exp: number;         // expiry (unix s)
}

// TODO: при переписывании фронта перевести на httpOnly cookies + отдельный refresh-token.
// Сейчас TTL уменьшен до 3 дней как компромисс между UX и риском кражи токена через XSS.
export async function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, ttlSec = 60 * 60 * 24 * 3): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const full: JwtPayload = { ...payload, iat: now, exp: now + ttlSec };
    const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const body = toBase64Url(encoder.encode(JSON.stringify(full)));
    const signingInput = `${header}.${body}`;
    const signature = await hmacSha256(signingInput, secret);
    return `${signingInput}.${toBase64Url(signature)}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;

    const expected = await hmacSha256(`${header}.${body}`, secret);
    if (!timingSafeEqual(new Uint8Array(expected), fromBase64Url(sig))) return null;

    let payload: JwtPayload;
    try {
        payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as JwtPayload;
    } catch {
        return null;
    }
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

async function hmacSha256(data: string, secret: string): Promise<ArrayBuffer> {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    return crypto.subtle.sign('HMAC', key, encoder.encode(data));
}
