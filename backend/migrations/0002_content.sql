-- Move album/track catalogue into the database so admins can manage it via UI.
-- Frontend can still ship data.js as a fallback during transition.

CREATE TABLE IF NOT EXISTS albums (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    year       TEXT NOT NULL,
    cover_key  TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tracks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id   INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    artist     TEXT NOT NULL DEFAULT 'CUPSIZE',
    duration   TEXT NOT NULL,
    audio_key  TEXT,
    lrc        TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id, sort_order);
