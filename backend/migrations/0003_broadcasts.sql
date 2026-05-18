-- Broadcasts are messages shown to all visitors (compact notification or full banner).
-- Only one broadcast per `kind` is "active" at a time; older rows are kept for history.

CREATE TABLE IF NOT EXISTS broadcasts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL CHECK (kind IN ('notification', 'banner')),
    title       TEXT NOT NULL,
    body        TEXT,             -- only used by banner
    image_key   TEXT,             -- only used by banner
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON broadcasts(kind, is_active, created_at);
