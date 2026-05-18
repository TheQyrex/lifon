-- Initial schema for LifonMUSIC.
-- Users authenticate with username + PBKDF2-hashed password.
-- Listens and likes are referenced by track_id (logical id matching frontend data).

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iter INTEGER NOT NULL DEFAULT 100000,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    avatar_key    TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    last_seen_at  INTEGER
);

CREATE TABLE IF NOT EXISTS listens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id    INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_listens_user      ON listens(user_id);
CREATE INDEX IF NOT EXISTS idx_listens_track     ON listens(track_id);
CREATE INDEX IF NOT EXISTS idx_listens_user_trk  ON listens(user_id, track_id);

CREATE TABLE IF NOT EXISTS likes (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id   INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_track ON likes(track_id);
