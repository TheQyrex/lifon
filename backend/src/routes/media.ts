import { Hono } from 'hono';
import type { AppEnv } from '../env';

const media = new Hono<AppEnv>();

// Serve R2 objects. Keys are opaque random IDs so no auth is required.
media.get('/:key{.+}', async (c) => serveMedia(c, true));
media.on('HEAD', '/:key{.+}', async (c) => serveMedia(c, false));

async function serveMedia(c: any, includeBody: boolean) {
    const key = c.req.param('key');
    const head = await c.env.MEDIA.head(key);
    if (!head) return c.json({ ok: false, error: 'not_found' }, 404);

    const range = parseRange(c.req.header('Range'), head.size);
    const object = await c.env.MEDIA.get(key, range ? { range: { offset: range.start, length: range.length } } : undefined);
    if (!object) return c.json({ ok: false, error: 'not_found' }, 404);

    const headers = new Headers();
    const ct = object.httpMetadata?.contentType;
    if (ct) headers.set('Content-Type', ct);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(range ? range.length : head.size));
    if (object.etag) headers.set('ETag', object.etag);
    // Allow cross-origin <img> and <audio> loading (secureHeaders sets same-origin by default)
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    if (range) {
        headers.set('Content-Range', `bytes ${range.start}-${range.end}/${head.size}`);
        return new Response(includeBody ? object.body : null, { status: 206, headers });
    }

    return new Response(includeBody ? object.body : null, { headers });
}

function parseRange(header: string | undefined, size: number): { start: number; end: number; length: number } | null {
    if (!header || !Number.isFinite(size) || size <= 0) return null;
    const match = header.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return null;

    const [, rawStart, rawEnd] = match;
    let start: number;
    let end: number;

    if (rawStart === '') {
        const suffixLength = Number(rawEnd);
        if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
        start = Math.max(size - suffixLength, 0);
        end = size - 1;
    } else {
        start = Number(rawStart);
        end = rawEnd === '' ? size - 1 : Number(rawEnd);
    }

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
        return null;
    }

    end = Math.min(end, size - 1);
    return { start, end, length: end - start + 1 };
}

export default media;
