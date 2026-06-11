-- 0015: Stat bonus columns for admin adjustments + reset all user passwords.
-- After this migration every user will be prompted to set a new password on first login.

ALTER TABLE users ADD COLUMN listens_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN listen_ms_bonus INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN unique_tracks_bonus INTEGER NOT NULL DEFAULT 0;

-- Reset all passwords so users create new ones on first login.
UPDATE users SET password_hash = '', password_salt = '', password_iter = 0;
