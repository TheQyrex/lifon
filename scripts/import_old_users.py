#!/usr/bin/env python3
"""
Импорт пользователей, лайков и прослушиваний из старой базы LifonMUSIC.

Использование:
  python3 scripts/import_old_users.py <путь_к_дампу.sql|бд.xlsx> [путь_к_db.sqlite]

Примеры:
  python3 scripts/import_old_users.py old_dump.sql
  python3 scripts/import_old_users.py old_dump.sql /var/www/lifonmusic/backend/data/db.sqlite

Пользователи импортируются с password_iter=0 (маркер «нет пароля»).
Они смогут войти только через Telegram — при этом введут свой старый ник
и новый пароль, система привяжет TG к существующему аккаунту.
"""

import sqlite3
import re
import sys
import os
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone


# ── Defaults ────────────────────────────────────────────────────────────────
DEFAULT_DB = "/var/www/lifonmusic/backend/data/db.sqlite"


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
        if str(s).strip().isdigit():
            return int(s)
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except Exception:
        return int(datetime.now(timezone.utc).timestamp())

def _parse_insert(line: str):
    m = re.match(
        r'INSERT\s+INTO\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*(?:\((.*?)\))?\s+VALUES\s*(\(.+\))\s*;?$',
        line,
        re.IGNORECASE,
    )
    if not m:
        return None

    table = m.group(1)
    cols_raw = m.group(2)
    values = _split_values(m.group(3))
    columns = re.findall(r'"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*)', cols_raw or '')
    column_names = [(quoted or plain) for quoted, plain in columns] or None
    return table, column_names, values

def _row_dict(columns: list[str] | None, values: list[object], fallback: list[str]) -> dict[str, object | None]:
    names = columns or fallback
    return {name: values[idx] if idx < len(values) else None for idx, name in enumerate(names)}

def _optional_unix(value: object | None) -> int | None:
    if value is None:
        return None
    return _iso_to_unix(str(value))

def _optional_int(value: object | None) -> int | None:
    if value is None:
        return None
    return int(value)

def _int_or(value: object | None, fallback: int) -> int:
    if value is None:
        return fallback
    return int(value)

def _password_from_legacy_hash(raw: object | None) -> dict[str, object]:
    if raw is None:
        return {"password_hash": "", "password_salt": "", "password_iter": 0, "require_telegram": 1}

    value = str(raw).strip()
    parts = value.split("$")
    if len(parts) == 4 and parts[0] == "pbkdf2":
        return {
            "password_hash": parts[3],
            "password_salt": parts[2],
            "password_iter": int(parts[1]),
            "require_telegram": 0,
        }
    if len(parts) == 3 and parts[0] == "pbkdf2":
        return {
            "password_hash": parts[2],
            "password_salt": parts[1],
            "password_iter": 100000,
            "require_telegram": 0,
        }

    return {"password_hash": "", "password_salt": "", "password_iter": 0, "require_telegram": 1}


def parse_dump(dump_path: str):
    users   = []   # list of dicts
    likes   = []
    listens = []

    with open(dump_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            parsed = _parse_insert(line)
            if not parsed:
                continue

            table, columns, vals = parsed

            if table == "users":
                row = _row_dict(columns, vals, ["id", "username", "pass_hash", "created_at", "avatar_url"])
                if row.get("id") is None or not row.get("username"):
                    continue
                legacy_password = _password_from_legacy_hash(row.get("pass_hash"))
                has_current_password = "password_hash" in row and row.get("password_hash") not in (None, "")
                created_at = _optional_unix(row.get("created_at"))
                last_seen_at = _optional_unix(row.get("last_seen_at"))
                users.append({
                    "old_id":     int(row["id"]),
                    "username":   str(row["username"]),
                    "password_hash": str(row.get("password_hash") or "") if has_current_password else legacy_password["password_hash"],
                    "password_salt": str(row.get("password_salt") or "") if has_current_password else legacy_password["password_salt"],
                    "password_iter": _int_or(row.get("password_iter"), 100000) if has_current_password else legacy_password["password_iter"],
                    "is_admin": _int_or(row.get("is_admin"), 0),
                    "avatar_key": str(row.get("avatar_key")) if row.get("avatar_key") else None,
                    "created_at": created_at or int(datetime.now(timezone.utc).timestamp()),
                    "last_seen_at": last_seen_at,
                    "telegram_id": _optional_int(row.get("telegram_id")),
                    "require_telegram": _int_or(row.get("require_telegram"), 0 if has_current_password else int(legacy_password["require_telegram"])),
                })

            elif table in ("liked_tracks", "likes"):
                row = _row_dict(columns, vals, ["user_id", "track_id", "created_at"])
                if row.get("user_id") is None or row.get("track_id") is None:
                    continue
                likes.append({
                    "user_id":    int(row["user_id"]),
                    "track_id":   int(row["track_id"]),
                    "created_at": _optional_unix(row.get("created_at")) or int(datetime.now(timezone.utc).timestamp()),
                })

            elif table in ("listen_history", "listens"):
                fallback = ["id", "user_id", "track_id", "duration_ms", "listened_at" if table == "listen_history" else "created_at"]
                row = _row_dict(columns, vals, fallback)
                if row.get("user_id") is None or row.get("track_id") is None or row.get("duration_ms") is None:
                    continue
                listens.append({
                    "user_id":     int(row["user_id"]),
                    "track_id":    int(row["track_id"]),
                    "duration_ms": int(row["duration_ms"]),
                    "created_at":  _optional_unix(row.get("created_at") or row.get("listened_at")) or int(datetime.now(timezone.utc).timestamp()),
                })

    return users, likes, listens


def _xlsx_col_to_idx(cell_ref: str) -> int:
    letters = ''.join(ch for ch in cell_ref if ch.isalpha()).upper()
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - ord('A') + 1)
    return idx - 1


def _xlsx_text(node: ET.Element, ns: dict[str, str]) -> str:
    return ''.join(t.text or '' for t in node.findall('.//main:t', ns))


def _read_xlsx_rows(path: str) -> list[list[object | None]]:
    ns = {
        'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        'rel': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'pkgrel': 'http://schemas.openxmlformats.org/package/2006/relationships',
    }

    with zipfile.ZipFile(path) as zf:
        shared: list[str] = []
        if 'xl/sharedStrings.xml' in zf.namelist():
            root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
            shared = [_xlsx_text(si, ns) for si in root.findall('main:si', ns)]

        wb = ET.fromstring(zf.read('xl/workbook.xml'))
        first_sheet = wb.find('main:sheets/main:sheet', ns)
        if first_sheet is None:
            return []
        rel_id = first_sheet.attrib[f'{{{ns["rel"]}}}id']

        rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
        target = None
        for rel in rels.findall('pkgrel:Relationship', ns):
            if rel.attrib.get('Id') == rel_id:
                target = rel.attrib.get('Target')
                break
        if not target:
            return []

        sheet_path = 'xl/' + target.lstrip('/')
        sheet = ET.fromstring(zf.read(sheet_path))

        rows: list[list[object | None]] = []
        for row_node in sheet.findall('.//main:sheetData/main:row', ns):
            row: list[object | None] = []
            for c in row_node.findall('main:c', ns):
                ref = c.attrib.get('r', '')
                col_idx = _xlsx_col_to_idx(ref)
                while len(row) <= col_idx:
                    row.append(None)

                cell_type = c.attrib.get('t')
                value_node = c.find('main:v', ns)
                if cell_type == 'inlineStr':
                    inline = c.find('main:is', ns)
                    value: object | None = _xlsx_text(inline, ns) if inline is not None else None
                elif value_node is None:
                    value = None
                elif cell_type == 's':
                    value = shared[int(value_node.text or '0')]
                else:
                    raw = value_node.text or ''
                    try:
                        value = int(raw)
                    except ValueError:
                        try:
                            value = float(raw)
                        except ValueError:
                            value = raw

                row[col_idx] = value
            rows.append(row)

        return rows


def _find_header(headers: list[object | None], expected: list[str]) -> int:
    normalized = [str(v).strip() if v is not None else '' for v in headers]
    for start in range(0, len(normalized) - len(expected) + 1):
        if normalized[start:start + len(expected)] == expected:
            return start
    raise ValueError(f"Не найдены колонки: {expected}")


def _cell(row: list[object | None], idx: int) -> object | None:
    return row[idx] if idx < len(row) else None


def parse_xlsx(xlsx_path: str):
    rows = _read_xlsx_rows(xlsx_path)
    if not rows:
        return [], [], []

    headers = rows[0]
    user_start = _find_header(headers, ['id', 'username', 'pass_hash', 'created_at', 'avatar_url'])
    like_start = _find_header(headers, ['user_id', 'track_id', 'created_at'])
    listen_start = _find_header(headers, ['id', 'user_id', 'track_id', 'duration_ms', 'listened_at'])

    users = []
    likes = []
    listens = []
    now = int(datetime.now(timezone.utc).timestamp())

    for row in rows[1:]:
        old_id = _cell(row, user_start)
        username = _cell(row, user_start + 1)
        if old_id is not None and username:
            created_raw = _cell(row, user_start + 3)
            avatar_raw = _cell(row, user_start + 4)
            avatar = str(avatar_raw) if avatar_raw and str(avatar_raw).upper() != 'NULL' else None
            password = _password_from_legacy_hash(_cell(row, user_start + 2))
            users.append({
                'old_id': int(old_id),
                'username': str(username),
                'password_hash': password['password_hash'],
                'password_salt': password['password_salt'],
                'password_iter': password['password_iter'],
                'require_telegram': password['require_telegram'],
                'is_admin': 0,
                'avatar_key': avatar,
                'created_at': _iso_to_unix(str(created_raw)) if created_raw else now,
                'avatar_url': avatar,
            })

        like_user = _cell(row, like_start)
        like_track = _cell(row, like_start + 1)
        if like_user is not None and like_track is not None:
            created = _cell(row, like_start + 2)
            likes.append({
                'user_id': int(like_user),
                'track_id': int(like_track),
                'created_at': int(created) if created is not None else now,
            })

        listen_user = _cell(row, listen_start + 1)
        listen_track = _cell(row, listen_start + 2)
        duration = _cell(row, listen_start + 3)
        if listen_user is not None and listen_track is not None and duration is not None:
            listened_at = _cell(row, listen_start + 4)
            listens.append({
                'user_id': int(listen_user),
                'track_id': int(listen_track),
                'duration_ms': int(duration),
                'created_at': int(listened_at) if listened_at is not None else now,
            })

    return users, likes, listens


def parse_source(path: str):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.xlsx':
        return parse_xlsx(path)
    return parse_dump(path)


# ── Import ───────────────────────────────────────────────────────────────────

def run_import(dump_path: str, db_path: str):
    print(f"Дамп:    {dump_path}")
    print(f"База:    {db_path}")
    print()

    users, likes, listens = parse_source(dump_path)
    print(f"Распарсено: {len(users)} юзеров, {len(likes)} лайков, {len(listens)} прослушиваний")
    print()

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")   # import order doesn't matter
    conn.execute("PRAGMA journal_mode = WAL")
    cur = conn.cursor()
    target_user_columns = {
        row[1] for row in cur.execute("PRAGMA table_info(users)").fetchall()
    }

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

        insert_values = {
            "username": u["username"],
            "password_hash": u.get("password_hash", ""),
            "password_salt": u.get("password_salt", ""),
            "password_iter": u.get("password_iter", 0),
            "is_admin": u.get("is_admin", 0),
            "avatar_key": u.get("avatar_key"),
            "created_at": u["created_at"],
            "last_seen_at": u.get("last_seen_at"),
            "telegram_id": u.get("telegram_id"),
            "require_telegram": u.get("require_telegram", 1),
        }
        insert_columns = [
            name for name in (
                "username",
                "password_hash",
                "password_salt",
                "password_iter",
                "is_admin",
                "avatar_key",
                "created_at",
                "last_seen_at",
                "telegram_id",
                "require_telegram",
            )
            if name in target_user_columns and insert_values.get(name) is not None
        ]
        placeholders = ", ".join("?" for _ in insert_columns)
        cur.execute(
            f"INSERT INTO users ({', '.join(insert_columns)}) VALUES ({placeholders})",
            tuple(insert_values[name] for name in insert_columns),
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
            exists = cur.execute(
                """SELECT 1 FROM listens
                   WHERE user_id = ? AND track_id = ? AND duration_ms = ? AND created_at = ?
                   LIMIT 1""",
                (new_uid, listen["track_id"], listen["duration_ms"], listen["created_at"])
            ).fetchone()
            if exists:
                skipped_listens += 1
            else:
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
