#!/bin/bash
# Скрипт миграции данных с Cloudflare на свой сервер.
# Запускать ОДИН РАЗ локально (там где установлен wrangler и есть доступ к Cloudflare).
# Потом перенести db.sqlite и папку media/ на сервер.

set -e

OUTPUT_DIR="./cloudflare-export"
mkdir -p "$OUTPUT_DIR/media"

echo "==> Экспорт базы данных D1..."
# Экспортирует всю БД в SQL-дамп
wrangler d1 export data --remote --output "$OUTPUT_DIR/dump.sql"

echo "==> Конвертация SQL-дампа в SQLite..."
# Убираем специфичные для D1 прагмы и создаём локальный db.sqlite
sqlite3 "$OUTPUT_DIR/db.sqlite" < "$OUTPUT_DIR/dump.sql"
echo "БД сохранена в $OUTPUT_DIR/db.sqlite"

echo ""
echo "==> Скачивание медиафайлов из R2..."
echo "    (обложки альбомов, аватары — НЕ аудио, аудио уже на сервере)"

# Список объектов в R2
wrangler r2 object list cupsize-media --remote | while read -r key; do
    key=$(echo "$key" | tr -d '[:space:]')
    [ -z "$key" ] && continue
    # Пропускаем аудио и лирику — они rsync'ятся отдельно
    if [[ "$key" == audio/* ]] || [[ "$key" == lyrics/* ]] || [[ "$key" == preview/* ]]; then
        continue
    fi
    echo "  Скачиваем: $key"
    mkdir -p "$OUTPUT_DIR/media/$(dirname "$key")"
    wrangler r2 object get "cupsize-media/$key" --remote --file "$OUTPUT_DIR/media/$key" 2>/dev/null || echo "  WARN: не удалось скачать $key"
done

echo ""
echo "==> Готово! Файлы для переноса на сервер:"
echo "    $OUTPUT_DIR/db.sqlite  →  /var/www/lifonmusic/data/db.sqlite"
echo "    $OUTPUT_DIR/media/     →  /var/www/lifonmusic/data/media/"
echo ""
echo "Команды для копирования на сервер:"
echo "  scp $OUTPUT_DIR/db.sqlite user@server:/var/www/lifonmusic/data/"
echo "  rsync -avz $OUTPUT_DIR/media/ user@server:/var/www/lifonmusic/data/media/"
