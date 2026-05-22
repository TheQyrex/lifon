import { Hono } from 'hono';
import type { AppEnv } from '../../env';
import { deleteFromR2, publicUrl } from '../../lib/r2';
import {
    validateNonEmptyString,
    validateOptionalString,
    ValidationError,
    validationErrorResponse,
} from '../../lib/validation';

const content = new Hono<AppEnv>();

content.get('/albums', async (c) => {
    const albumRows = await c.env.DB.prepare(
        `SELECT id, title, year, cover_key, sort_order, glow_color
         FROM albums
         ORDER BY sort_order ASC, id ASC`,
    ).all<{ id: number; title: string; year: string; cover_key: string | null; sort_order: number; glow_color: string | null }>();

    const trackRows = await c.env.DB.prepare(
        `SELECT id, album_id, title, artist, duration, audio_key, cover_key, lrc, sort_order
         FROM tracks
         ORDER BY album_id ASC, sort_order ASC, id ASC`,
    ).all<{
        id: number;
        album_id: number;
        title: string;
        artist: string;
        duration: string;
        audio_key: string | null;
        cover_key: string | null;
        lrc: string | null;
        sort_order: number;
    }>();

    const byAlbum = new Map<number, typeof trackRows.results>();
    for (const t of trackRows.results) {
        const list = byAlbum.get(t.album_id) ?? [];
        list.push(t);
        byAlbum.set(t.album_id, list);
    }

    return c.json({
        ok: true,
        albums: albumRows.results.map(a => ({
            id: a.id,
            title: a.title,
            year: a.year,
            cover_key: a.cover_key,
            cover_url: publicUrl(c.env, a.cover_key),
            cover: publicUrl(c.env, a.cover_key),
            sort_order: a.sort_order,
            glow_color: a.glow_color ?? null,
            tracks: (byAlbum.get(a.id) ?? []).map(t => ({
                id: t.id,
                album_id: t.album_id,
                albumId: t.album_id,
                title: t.title,
                artist: t.artist,
                duration: t.duration,
                audio_key: t.audio_key,
                audio_url: publicUrl(c.env, t.audio_key),
                audio: publicUrl(c.env, t.audio_key),
                cover_key: t.cover_key,
                cover_url: publicUrl(c.env, t.cover_key),
                lrc: t.lrc,
                sort_order: t.sort_order,
            })),
        })),
    });
});

// PATCH /albums/reorder - bulk sort_order update
content.patch('/albums/reorder', async (c) => {
    const body = await c.req.json<{ items?: unknown }>().catch(() => ({ items: undefined }));
    if (!Array.isArray(body.items)) return c.json({ ok: false, error: 'bad_request' }, 400);
    const stmts = (body.items as { id: number; sort_order: number }[]).map(({ id, sort_order }) =>
        c.env.DB.prepare('UPDATE albums SET sort_order = ? WHERE id = ?').bind(Number(sort_order), Number(id))
    );
    if (stmts.length) await c.env.DB.batch(stmts);
    return c.json({ ok: true });
});

// PATCH /tracks/reorder
content.patch('/tracks/reorder', async (c) => {
    const body = await c.req.json<{ items?: unknown }>().catch(() => ({ items: undefined }));
    if (!Array.isArray(body.items)) return c.json({ ok: false, error: 'bad_request' }, 400);
    const stmts = (body.items as { id: number; sort_order: number }[]).map(({ id, sort_order }) =>
        c.env.DB.prepare('UPDATE tracks SET sort_order = ? WHERE id = ?').bind(Number(sort_order), Number(id))
    );
    if (stmts.length) await c.env.DB.batch(stmts);
    return c.json({ ok: true });
});

// ----- Albums -----

content.post('/albums', async (c) => {
    let requestedId: number | null;
    let title: string;
    let year: string;
    let coverKey: string | null | undefined;
    let sortOrder: number | undefined;
    try {
        const body = await c.req.json<{
            title?: unknown;
            year?: unknown;
            cover_key?: unknown;
            sort_order?: unknown;
            id?: unknown;
        }>();
        const idNum = Number(body.id);
        requestedId = Number.isInteger(idNum) && idNum > 0 ? idNum : null;
        title = validateNonEmptyString('title', body.title, 200);
        year = validateNonEmptyString('year', body.year, 16);
        coverKey = validateOptionalString('cover_key', body.cover_key, 300);
        sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const row = requestedId
        ? await c.env.DB.prepare(
            `INSERT INTO albums (id, title, year, cover_key, sort_order) VALUES (?, ?, ?, ?, ?) RETURNING id`,
        ).bind(requestedId, title, year, coverKey, sortOrder).first<{ id: number }>()
        : await c.env.DB.prepare(
            `INSERT INTO albums (title, year, cover_key, sort_order) VALUES (?, ?, ?, ?) RETURNING id`,
        ).bind(title, year, coverKey, sortOrder).first<{ id: number }>();

    return c.json({ ok: true, id: row?.id });
});

content.put('/albums/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    let title: string;
    let year: string;
    let coverKey: string | null | undefined;
    let sortOrder: number | undefined;
    let glowColor: string | null | undefined;
    try {
        const body = await c.req.json<{
            title?: unknown;
            year?: unknown;
            cover_key?: unknown;
            sort_order?: unknown;
            glow_color?: unknown;
        }>();
        title = validateNonEmptyString('title', body.title, 200);
        year = validateOptionalString('year', body.year, 16) ?? '';
        coverKey = body.cover_key === undefined ? undefined : validateOptionalString('cover_key', body.cover_key, 300);
        sortOrder = body.sort_order === undefined ? undefined : Number(body.sort_order);
        glowColor = body.glow_color === undefined ? undefined : validateOptionalString('glow_color', body.glow_color, 20);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const prev = await c.env.DB.prepare('SELECT cover_key, sort_order, glow_color FROM albums WHERE id = ?')
        .bind(id).first<{ cover_key: string | null; sort_order: number; glow_color: string | null }>();
    if (!prev) return c.json({ ok: false, error: 'not_found' }, 404);

    const nextCoverKey = coverKey === undefined ? prev.cover_key : coverKey;
    const nextSortOrder = Number.isFinite(sortOrder) ? Number(sortOrder) : prev.sort_order;
    const nextGlowColor = glowColor === undefined ? prev.glow_color : glowColor;

    await c.env.DB.prepare(
        `UPDATE albums SET title = ?, year = ?, cover_key = ?, sort_order = ?, glow_color = ? WHERE id = ?`,
    ).bind(title, year, nextCoverKey, nextSortOrder, nextGlowColor, id).run();

    if (prev.cover_key && prev.cover_key !== nextCoverKey) {
        c.executionCtx.waitUntil(deleteFromR2(c.env, prev.cover_key));
    }

    return c.json({ ok: true });
});

content.delete('/albums/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const tracks = await c.env.DB.prepare(
        `SELECT cover_key FROM albums WHERE id = ?`,
    ).bind(id).first<{ cover_key: string | null }>();

    const trackAssets = await c.env.DB.prepare(
        `SELECT audio_key FROM tracks WHERE album_id = ? AND audio_key IS NOT NULL`,
    ).bind(id).all<{ audio_key: string }>();

    await c.env.DB.prepare('DELETE FROM albums WHERE id = ?').bind(id).run();

    // Tracks are cascade-deleted by FK; clean up their R2 objects in the background.
    c.executionCtx.waitUntil((async () => {
        if (tracks?.cover_key) await deleteFromR2(c.env, tracks.cover_key);
        for (const t of trackAssets.results) await deleteFromR2(c.env, t.audio_key);
    })());

    return c.json({ ok: true });
});

// ----- Tracks -----

content.post('/tracks', async (c) => {
    let requestedId: number | null;
    let albumId: number;
    let title: string;
    let artist: string;
    let duration: string;
    let audioKey: string | null | undefined;
    let coverKey: string | null | undefined;
    let lrc: string | null | undefined;
    let sortOrder: number | undefined;
    try {
        const body = await c.req.json<{
            album_id?: unknown;
            title?: unknown;
            artist?: unknown;
            duration?: unknown;
            audio_key?: unknown;
            cover_key?: unknown;
            lrc?: unknown;
            sort_order?: unknown;
            id?: unknown;
        }>();
        const requestedIdNum = Number(body.id);
        requestedId = Number.isInteger(requestedIdNum) && requestedIdNum > 0 ? requestedIdNum : null;
        const albumIdNum = Number(body.album_id);
        if (!Number.isInteger(albumIdNum) || albumIdNum <= 0) {
            throw new ValidationError('album_id', 'album_id обязателен');
        }
        albumId = albumIdNum;
        title = validateNonEmptyString('title', body.title, 200);
        artist = (validateOptionalString('artist', body.artist, 200)) ?? 'CUPSIZE';
        duration = validateNonEmptyString('duration', body.duration, 16);
        audioKey = validateOptionalString('audio_key', body.audio_key, 300);
        coverKey = validateOptionalString('cover_key', body.cover_key, 300);
        lrc = validateOptionalString('lrc', body.lrc, 50_000);
        sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const albumExists = await c.env.DB.prepare('SELECT id FROM albums WHERE id = ?')
        .bind(albumId).first<{ id: number }>();
    if (!albumExists) return c.json({ ok: false, error: 'album_not_found' }, 404);

    const row = requestedId
        ? await c.env.DB.prepare(
            `INSERT INTO tracks (id, album_id, title, artist, duration, audio_key, cover_key, lrc, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        ).bind(requestedId, albumId, title, artist, duration, audioKey, coverKey, lrc, sortOrder).first<{ id: number }>()
        : await c.env.DB.prepare(
            `INSERT INTO tracks (album_id, title, artist, duration, audio_key, cover_key, lrc, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        ).bind(albumId, title, artist, duration, audioKey, coverKey, lrc, sortOrder).first<{ id: number }>();

    return c.json({ ok: true, id: row?.id });
});

content.put('/tracks/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    let title: string;
    let artist: string;
    let duration: string;
    let audioKey: string | null | undefined;
    let coverKey: string | null | undefined;
    let lrc: string | null | undefined;
    let sortOrder: number | undefined;
    try {
        const body = await c.req.json<{
            title?: unknown;
            artist?: unknown;
            duration?: unknown;
            audio_key?: unknown;
            cover_key?: unknown;
            lrc?: unknown;
            sort_order?: unknown;
        }>();
        title = validateNonEmptyString('title', body.title, 200);
        artist = (validateOptionalString('artist', body.artist, 200)) ?? 'CUPSIZE';
        duration = validateNonEmptyString('duration', body.duration, 16);
        audioKey = body.audio_key === undefined ? undefined : validateOptionalString('audio_key', body.audio_key, 300);
        coverKey = body.cover_key === undefined ? undefined : validateOptionalString('cover_key', body.cover_key, 300);
        lrc = body.lrc === undefined ? undefined : validateOptionalString('lrc', body.lrc, 50_000);
        sortOrder = body.sort_order === undefined ? undefined : Number(body.sort_order);
    } catch (err) {
        return validationErrorResponse(c, err);
    }

    const prev = await c.env.DB.prepare('SELECT audio_key, cover_key, lrc, sort_order FROM tracks WHERE id = ?')
        .bind(id).first<{ audio_key: string | null; cover_key: string | null; lrc: string | null; sort_order: number }>();
    if (!prev) return c.json({ ok: false, error: 'not_found' }, 404);

    const nextAudioKey = audioKey === undefined ? prev.audio_key : audioKey;
    const nextCoverKey = coverKey === undefined ? prev.cover_key : coverKey;
    const nextLrc = lrc === undefined ? prev.lrc : lrc;
    const nextSortOrder = Number.isFinite(sortOrder) ? Number(sortOrder) : prev.sort_order;

    await c.env.DB.prepare(
        `UPDATE tracks
         SET title = ?, artist = ?, duration = ?, audio_key = ?, cover_key = ?, lrc = ?, sort_order = ?
         WHERE id = ?`,
    ).bind(title, artist, duration, nextAudioKey, nextCoverKey, nextLrc, nextSortOrder, id).run();

    c.executionCtx.waitUntil((async () => {
        if (prev.audio_key && prev.audio_key !== nextAudioKey) await deleteFromR2(c.env, prev.audio_key);
        if (prev.cover_key && prev.cover_key !== nextCoverKey) await deleteFromR2(c.env, prev.cover_key);
    })());

    return c.json({ ok: true });
});

content.delete('/tracks/:id', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const prev = await c.env.DB.prepare('SELECT audio_key, cover_key FROM tracks WHERE id = ?')
        .bind(id).first<{ audio_key: string | null; cover_key: string | null }>();

    await c.env.DB.prepare('DELETE FROM tracks WHERE id = ?').bind(id).run();

    c.executionCtx.waitUntil((async () => {
        if (prev?.audio_key) await deleteFromR2(c.env, prev.audio_key);
        if (prev?.cover_key) await deleteFromR2(c.env, prev.cover_key);
    })());
    return c.json({ ok: true });
});


export default content;
