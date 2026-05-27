-- Track which platform recorded each listen: 'web', 'android', 'ios'
ALTER TABLE listens ADD COLUMN platform TEXT NOT NULL DEFAULT 'web';
