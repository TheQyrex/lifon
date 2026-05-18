-- Активные слушатели: каждая запись = «юзер X слушает трек Y», обновляется heartbeat-ом.
-- Старые записи отфильтровываются по updated_at, физическая чистка — отдельным cron-cleanup.

CREATE TABLE IF NOT EXISTS live_sessions (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    track_id   INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_live_track   ON live_sessions(track_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_live_updated ON live_sessions(updated_at);
