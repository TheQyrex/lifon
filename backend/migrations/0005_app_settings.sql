-- App-wide runtime switches controlled from the admin panel.

CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('maintenance', '{"enabled":false,"message":"Сайт находится на технических работах"}');
