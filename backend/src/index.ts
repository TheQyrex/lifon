import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './env';
import auth from './routes/auth';
import likes from './routes/likes';
import listens from './routes/listens';
import stats from './routes/stats';
import profile from './routes/profile';
import notifications from './routes/notifications';
import albums from './routes/albums';
import admin from './routes/admin';
import media from './routes/media';
import { maintenanceGate } from './lib/maintenance';
import { rateLimitMiddleware } from './lib/ratelimit';

const app = new Hono<AppEnv>();

// Must be registered before secureHeaders so its after-next() runs last and wins.
app.use('/media/*', async (c, next) => {
    await next();
    c.res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    c.res.headers.set('Access-Control-Allow-Origin', '*');
});

// API возвращает только JSON и медиа — никакого скрипта, никаких фреймов.
app.use('*', secureHeaders({
    contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
    },
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    referrerPolicy: 'strict-origin-when-cross-origin',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    permissionsPolicy: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
    },
}));

app.use('*', (c, next) => {
    const allowed = c.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
    const middleware = cors({
        origin: (origin) => (origin && allowed.includes(origin)) ? origin : null,
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
        credentials: false,
        maxAge: 600,
    });
    return middleware(c, next);
});

app.use('*', maintenanceGate);

// Жёсткий лимит на размер запроса. Workers по умолчанию пропускает до 100 МБ JSON,
// что для нашего API избыточно. multipart-аплоады проходят отдельной валидацией в r2.ts.
app.use('*', async (c, next) => {
    const ct = c.req.header('content-type') || '';
    if (ct.startsWith('multipart/form-data')) return next(); // файлы — отдельная история
    const len = Number(c.req.header('content-length') || 0);
    if (len > 64 * 1024) {
        return c.json({ ok: false, error: 'payload_too_large' }, 413);
    }
    await next();
});

app.get('/', (c) => c.json({ ok: true, service: 'cupsize-api' }));

// Лимиты для публичных read-эндпоинтов (без auth) — против скрапа и DoS.
const publicReadLimit = rateLimitMiddleware({ name: 'pub:read', limit: 120, windowSec: 60 });
// Лимиты для авторизованных write-эндпоинтов — против накрутки лайков/прослушиваний.
const userWriteLimit  = rateLimitMiddleware({ name: 'user:write', limit: 120, windowSec: 60, perUser: true });

app.use('/albums/*',       publicReadLimit);
app.use('/notification/*', publicReadLimit);
app.use('/supporters',     publicReadLimit);

// Медиа дороже остального (Worker invocation + R2 read на каждом запросе). Range-запросы
// при перемотке генерируют несколько хитов на трек, поэтому лимит выше остальных публичных.
app.use('/media/*', rateLimitMiddleware({ name: 'media', limit: 600, windowSec: 5 * 60 }));

app.route('/auth', auth);
app.use('/likes/*',   userWriteLimit);
app.use('/listens/*', userWriteLimit);
app.route('/likes', likes);
app.route('/listens', listens);
app.route('/stats', stats);
app.route('/profile', profile);
app.route('/notification', notifications);
app.route('/albums', albums);
app.route('/admin', admin);
app.route('/media', media);

app.get('/supporters', async (c) => {
    const rows = await c.env.DB.prepare(
        'SELECT id, name, handle, color, sort_order FROM supporters ORDER BY sort_order, id'
    ).all();
    return c.json({ ok: true, supporters: rows.results });
});

app.notFound((c) => c.json({ ok: false, error: 'not_found' }, 404));

app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json({ ok: false, error: 'server_error' }, 500);
});

export default app;
