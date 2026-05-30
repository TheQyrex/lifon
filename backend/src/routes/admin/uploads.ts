import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { isUploadKind, uploadToR2, UploadError } from '../../lib/r2';

const uploads = new Hono<AppEnv>();

// Generic admin upload endpoint. Returns the R2 key + public URL.
// Callers persist the returned key against the relevant DB row
// (albums.cover_key, tracks.audio_key, broadcasts.image_key, …).
uploads.post('/', async (c) => {
    let form: FormData;
    try {
        form = await c.req.formData();
    } catch {
        return c.json({ ok: false, error: 'invalid_form' }, 400);
    }

    const kindRaw = form.get('kind');
    const file = form.get('file') as File | null;

    if (typeof kindRaw !== 'string' || !isUploadKind(kindRaw)) {
        return c.json({ ok: false, error: 'bad_kind' }, 400);
    }
    if (!file || typeof file !== 'object' || typeof file.stream !== 'function') {
        return c.json({ ok: false, error: 'no_file' }, 400);
    }

    try {
        const { key, url } = await uploadToR2(c.env, kindRaw, file);
        return c.json({ ok: true, key, url });
    } catch (err) {
        if (err instanceof UploadError) {
            return c.json({ ok: false, error: 'upload_rejected', message: err.message }, err.status as any);
        }
        throw err;
    }
});

export default uploads;
