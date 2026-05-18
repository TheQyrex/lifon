import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { publicUrl } from '../lib/r2';

const albums = new Hono<AppEnv>();

// Public catalogue endpoint. Frontend can use this instead of the bundled data.js
// once enough content has been migrated/added through the admin panel.
albums.get('/', async (c) => {
    const albumRows = await c.env.DB.prepare(
        `SELECT id, title, year, cover_key, sort_order
         FROM albums
         ORDER BY sort_order ASC, id ASC`,
    ).all<{ id: number; title: string; year: string; cover_key: string | null; sort_order: number }>();

    if (albumRows.results.length === 0) return c.json({ ok: true, albums: [] });

    const trackRows = await c.env.DB.prepare(
        `SELECT id, album_id, title, artist, duration, audio_key, sort_order
         FROM tracks
         ORDER BY album_id ASC, sort_order ASC, id ASC`,
    ).all<{
        id: number;
        album_id: number;
        title: string;
        artist: string;
        duration: string;
        audio_key: string | null;
        sort_order: number;
    }>();

    const byAlbum = new Map<number, typeof trackRows.results>();
    for (const t of trackRows.results) {
        const list = byAlbum.get(t.album_id) ?? [];
        list.push(t);
        byAlbum.set(t.album_id, list);
    }

    const out = albumRows.results.map(a => ({
        id: a.id,
        title: a.title,
        year: a.year,
        cover: publicUrl(c.env, a.cover_key),
        cover_url: publicUrl(c.env, a.cover_key),
        sort_order: a.sort_order,
        tracks: (byAlbum.get(a.id) ?? []).map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            duration: t.duration,
            audio: publicUrl(c.env, t.audio_key),
            audio_url: publicUrl(c.env, t.audio_key),
            album_id: t.album_id,
            albumId: t.album_id,
            sort_order: t.sort_order,
        })),
    }));

    return c.json({ ok: true, albums: out });
});

// Per-track lyrics. Returns the raw LRC text (or null if absent).
albums.get('/tracks/:id/lyrics', async (c) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) return c.json({ ok: false, error: 'bad_id' }, 400);

    const row = await c.env.DB.prepare('SELECT lrc FROM tracks WHERE id = ?')
        .bind(id).first<{ lrc: string | null }>();

    return c.json({ ok: true, lrc: row?.lrc ?? null });
});

export default albums;
