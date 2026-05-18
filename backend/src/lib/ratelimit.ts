// Fixed-window rate limiter backed by Workers KV.
// Good enough for login/register brute-force protection; for hot paths use Durable Objects.

import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Env } from '../env';

export interface RateLimitResult {
    ok: boolean;
    remaining: number;
    resetAt: number;
}

export async function rateLimit(
    env: Env,
    key: string,
    limit: number,
    windowSec: number,
): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(now / windowSec);
    const fullKey = `rl:${key}:${bucket}`;
    const raw = await env.RATELIMIT.get(fullKey);
    const count = raw ? parseInt(raw, 10) || 0 : 0;

    if (count >= limit) {
        return { ok: false, remaining: 0, resetAt: (bucket + 1) * windowSec };
    }

    // KV is eventually consistent — under heavy concurrency a few extra requests
    // may slip through. That's acceptable for the abuse-prevention use case.
    await env.RATELIMIT.put(fullKey, String(count + 1), {
        expirationTtl: windowSec + 5,
    });

    return { ok: true, remaining: limit - count - 1, resetAt: (bucket + 1) * windowSec };
}

export function clientIp(req: Request): string {
    return req.headers.get('cf-connecting-ip')
        ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? 'unknown';
}

export interface RateLimitOptions {
    name: string;
    limit: number;
    windowSec: number;
    perUser?: boolean;
}

/**
 * Middleware-обёртка. perUser=true берёт user.id (требует уже выставленного user в context),
 * иначе — IP. Возвращает 429 при превышении.
 */
export function rateLimitMiddleware(opts: RateLimitOptions): MiddlewareHandler<AppEnv> {
    return async (c, next) => {
        const user = c.get('user');
        const subject = opts.perUser && user
            ? `u${user.id}`
            : `ip${clientIp(c.req.raw)}`;
        const key = `${opts.name}:${subject}`;
        const result = await rateLimit(c.env, key, opts.limit, opts.windowSec);
        if (!result.ok) {
            c.header('Retry-After', String(Math.max(1, result.resetAt - Math.floor(Date.now() / 1000))));
            return c.json({ ok: false, error: 'rate_limited', resetAt: result.resetAt }, 429);
        }
        await next();
    };
}
