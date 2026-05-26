#!/usr/bin/env python3
"""
Импорт пользователей, лайков и прослушиваний из старой базы LifonMUSIC.

Использование:
  python3 scripts/import_old_users.py <путь_к_дампу.sql> [путь_к_db.sqlite]

Примеры:
  python3 scripts/import_old_users.py old_dump.sql
  python3 scripts/import_old_users.py old_dump.sql /var/www/lifonmusic/data/db.sqlite

Пользователи импортируются с password_iter=0 (маркер «нет пароля»).
Они смогут войти только через Telegram — при этом введут свой старый ник
и новый пароль, система привяжет TG к существующему аккаунту.
"""

import sqlite3
import re
import sys
import os
from datetime import datetime, timezone


# ── Defaults ────────────────────────────────────────────────────────────────
DEFAULT_DB = "/var/www/lifonmusic/data/db.sqlite"


# ── Parsers ─────────────────────────────────────────────────────────────────

def _unescape(s: str) -> str:
    """Unescape SQLite string (only '' → ')."""
    return s.replace("''", "'")

def _parse_value(raw: str) -> str | int | None:
    raw = raw.strip()
    if raw == "NULL":
        return None
    if raw.startswith("'") and raw.endswith("'"):
        return _unescape(raw[1:-1])
    try:
        return int(raw)
    except ValueError:
        return raw

def _split_values(row: str):
    """Split a VALUES(...) row respecting quoted strings."""
    row = row.strip()
    if row.startswith("("):
        row = row[1:]
    if row.endswith(")"):
        row = row[:-1]
    parts = []
    buf = ""
    in_q = False
    i = 0
    while i < len(row):
        ch = row[i]
        if in_q:
            if ch == "'" and i + 1 < len(row) and row[i + 1] == "'":
                buf += "''"
                i += 2
                continue
            elif ch == "'":
                buf += ch
                in_q = False
            else:
                buf += ch
        else:
            if ch == "'":
                buf += ch
                in_q = True
            elif ch == ",":
                parts.append(_parse_value(buf))
                buf = ""
                i += 1
                continue
            else:
                buf += ch
        i += 1
    parts.append(_parse_value(buf))
    return parts

def _iso_to_unix(s: str) -> int:
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except Exception:
        return int(datetime.now(timezone.utc).timestamp())


def parse_dump(dump_path: str):
    users   = []   # list of dicts
    likes   = []
    listens = []

    with open(dump_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()

            if line.startswith('INSERT INTO "users"'):
                m = re.search(r'VALUES\s*(\(.+\))\s*;?$', line)
                if not m:
                    continue
                vals = _split_values(m.group(1))
                # id, username, pass_hash, created_at, avatar_url
                if len(vals) < 4:
                    continue
                uid, username, _, created_at_raw = vals[0], vals[1], vals[2], vals[3]
                avatar_url = vals[4] if len(vals) > 4 else None
                created_at = _iso_to_unix(str(created_at_raw)) if created_at_raw else None
                users.append({
                    "old_id":     int(uid),
                    "username":   str(username),
                    "created_at": created_at or int(datetime.now(timezone.utc).timestamp()),
                    "avatar_url": str(avatar_url) if avatar_url else None,
                })

            elif line.startswith('INSERT INTO "liked_tracks"'):
                m = re.search(r'VALUES\s*(\(.+\))\s*;?$', line)
                if not m:
                    continue
                vals = _split_values(m.group(1))
                # user_id, track_id, created_at
                if len(vals) < 3:
                    continue
                likes.append({
                    "user_id":    int(vals[0]),
                    "track_id":   int(vals[1]),
                    "created_at": int(vals[2]),
                })

            elif line.startswith('INSERT INTO "listen_history"'):
                m = re.search(r'VALUES\s*(\(.+\))\s*;?$', line)
                if not m:
                    continue
                vals = _split_values(m.group(1))
                # id, user_id, track_id, duration_ms, listened_at
                if len(vals) < 5:
                    continue
                listens.append({
                    "user_id":     int(vals[1]),
                    "track_id":    int(vals[2]),
                    "duration_ms": int(vals[3]),
                    "created_at":  int(vals[4]),
                })

    return users, likes, listens


# ── Import ───────────────────────────────────────────────────────────────────

def run_import(dump_path: str, db_path: str):
    print(f"Дамп:    {dump_path}")
    print(f"База:    {db_path}")
    print()

    users, likes, listens = parse_dump(dump_path)
    print(f"Распарсено: {len(users)} юзеров, {len(likes)} лайков, {len(listens)} прослушиваний")
    print()

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")   # import order doesn't matter
    conn.execute("PRAGMA journal_mode = WAL")
    cur = conn.cursor()

    # ── Users ────────────────────────────────────────────────────────────────
    id_map: dict[int, int] = {}   # old_id → new_id
    imported_users = 0
    skipped_users  = 0

    for u in users:
        # Check for username collision
        row = cur.execute(
            "SELECT id, password_iter FROM users WHERE username = ? COLLATE NOCASE",
            (u["username"],)
        ).fetchone()

        if row:
            new_id, pw_iter = row
            id_map[u["old_id"]] = new_id
            skipped_users += 1
            marker = "(уже существует, настоящий аккаунт)" if pw_iter != 0 else "(уже мигрирован)"
            print(f"  ПРОПУСК  [{u['old_id']:>3}] {u['username']!r:30s} → id={new_id} {marker}")
            continue

        # Insert migrated user: password_iter=0 = «нет пароля, только TG»
        cur.execute(
            """INSERT INTO users
               (username, password_hash, password_salt, password_iter,
                require_telegram, created_at)
               VALUES (?, '', '', 0, 1, ?)""",
            (u["username"], u["created_at"])
        )
        new_id = cur.lastrowid
        id_map[u["old_id"]] = new_id
        imported_users += 1
        print(f"  ИМПОРТ   [{u['old_id']:>3}] {u['username']!r:30s} → id={new_id}")

    conn.commit()
    print()
    print(f"Юзеры: {imported_users} импортировано, {skipped_users} пропущено")
    print()

    # ── Likes ────────────────────────────────────────────────────────────────
    imported_likes = 0
    skipped_likes  = 0

    for like in likes:
        new_uid = id_map.get(like["user_id"])
        if new_uid is None:
            skipped_likes += 1
            continue
        try:
            cur.execute(
                "INSERT OR IGNORE INTO likes (user_id, track_id, created_at) VALUES (?, ?, ?)",
                (new_uid, like["track_id"], like["created_at"])
            )
            if cur.rowcount:
                imported_likes += 1
            else:
                skipped_likes += 1
        except Exception as e:
            print(f"  WARN лайк: {e}")
            skipped_likes += 1

    conn.commit()
    print(f"Лайки: {imported_likes} импортировано, {skipped_likes} пропущено")

    # ── Listens ──────────────────────────────────────────────────────────────
    imported_listens = 0
    skipped_listens  = 0

    for listen in listens:
        new_uid = id_map.get(listen["user_id"])
        if new_uid is None:
            skipped_listens += 1
            continue
        try:
            cur.execute(
                "INSERT INTO listens (user_id, track_id, duration_ms, created_at) VALUES (?, ?, ?, ?)",
                (new_uid, listen["track_id"], listen["duration_ms"], listen["created_at"])
            )
            imported_listens += 1
        except Exception as e:
            print(f"  WARN прослушивание: {e}")
            skipped_listens += 1

    conn.commit()
    print(f"Прослушивания: {imported_listens} импортировано, {skipped_listens} пропущено")

    conn.execute("PRAGMA foreign_keys = ON")
    conn.close()
    print()
    print("Готово!")
    print()
    print("Следующий шаг: перезапусти бэкенд (pm2 restart) — изменений схемы нет,")
    print("рестарт нужен чтобы очистить in-memory кэши, если есть.")


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    dump  = sys.argv[1]
    db    = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_DB

    if not os.path.isfile(dump):
        print(f"Ошибка: дамп не найден: {dump}")
        sys.exit(1)
    if not os.path.isfile(db):
        print(f"Ошибка: база не найдена: {db}")
        sys.exit(1)

    run_import(dump, db)
