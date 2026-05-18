-- Supporters shown on the About page, editable from the admin panel.

CREATE TABLE IF NOT EXISTS supporters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    handle     TEXT    NOT NULL,
    color      TEXT    NOT NULL DEFAULT '#8b5cf6',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT INTO supporters (id, name, handle, color, sort_order) VALUES
    (1, 'Sergey',      '@sparklesparky', '#8b5cf6', 0),
    (2, 'mngl',        '@mngl15',        '#8b5cf6', 1),
    (3, 'Ya_kro',      '@Ya_kro',        '#8b5cf6', 2),
    (4, 'zzedqq',      '@zzedqq7',       '#8b5cf6', 3),
    (5, 'vers #lisoff!','@versupp',      '#8b5cf6', 4),
    (6, 'strannow',    '@strannow',      '#8b5cf6', 5);
