-- Флаг «нужен Telegram». DEFAULT 1 — все существующие (мигрированные) пользователи
-- без telegram_id обязаны привязать TG при следующем входе.
-- При ручном создании через админку флаг можно выключить.
ALTER TABLE users ADD COLUMN require_telegram INTEGER NOT NULL DEFAULT 1;
