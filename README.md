# LifonMUSIC

Фан-плеер группы CUPSIZE. Состоит из двух независимо разворачиваемых частей:

```
LifonMusic/
├── frontend/          # vanilla JS + HTML, статика
│   ├── index.html     # плеер
│   ├── admin/         # отдельная страница админки
│   ├── lib/           # api / dom / render helpers
│   ├── audio/ lyrics/ preview/ font/  # ассеты (на R2 в проде)
│   └── …
└── backend/           # Cloudflare Worker (Hono + D1 + R2 + KV)
    ├── src/           # auth, likes, listens, stats, profile,
    │                  # notification, albums, admin/*
    ├── migrations/    # schema
    └── README.md      # подробная инструкция по backend
```

## Что улучшено в этой итерации

**Безопасность.**
- Пароли хешируются PBKDF2-HMAC-SHA256 (100k итераций, случайная соль на пользователя).
- Сессии — JWT HS256, секрет из `wrangler secret`, 7 дней.
- Login/register прикрыты rate-limit (KV-based fixed window).
- CORS-allowlist вместо `*`.
- Все админские endpoint'ы за middleware `requireAdmin` (флаг `is_admin` в users).
- Загрузка файлов проверяет MIME + размер по каждому виду (avatar / cover / audio / image / lrc).
- Опасные `innerHTML` для альбомов/треков/профиля заменены на безопасный DOM API
  (`frontend/lib/dom.js`, `frontend/lib/render.js`).
- Валидация имени пользователя `^[a-z0-9._-]{3,24}$`, пароля 8–200 символов.

**Админка** (`frontend/admin/admin.html`):
- Статистика (пользователи, прослушивания, лайки, топ треков).
- Рассылка двух типов:
  - **Уведомление** — узкая полоса сверху сайта, только заголовок.
  - **Баннер** — полноэкранная модалка с заголовком, текстом (Markdown-подсветка
    `*italic*`, `**bold**`, `` `mono` ``) и опциональной картинкой.
- Создание/удаление альбомов и треков с загрузкой обложек и аудио прямо в R2.
- Свободная загрузка файлов в R2 (`/admin/uploads`).

**Профиль:** загрузка/удаление аватарки с проверкой размера на клиенте и сервере.

## Развёртывание

Подробности — `backend/README.md`. Кратко:

```bash
cd backend
npm install
npx wrangler login

# Создать D1, два KV (RATELIMIT и NOTIFICATIONS), R2-бакет cupsize-media;
# вписать id-шники в wrangler.toml.
npx wrangler d1 create cupsize-db
npx wrangler kv namespace create RATELIMIT
npx wrangler kv namespace create NOTIFICATIONS
npx wrangler r2 bucket create cupsize-media

# Секреты
npx wrangler secret put JWT_SECRET           # 32+ случайных байт
npx wrangler secret put ADMIN_BOOTSTRAP      # необязательно: имя, которому
                                              # дать is_admin при регистрации

# Миграции и деплой
npm run db:apply:remote
npm run deploy
```

Сделать админом существующего пользователя:

```bash
npx wrangler d1 execute cupsize-db --remote --command \
  "UPDATE users SET is_admin = 1 WHERE username = 'qyrex';"
```

**Frontend** — статика, разворачивается куда угодно (Cloudflare Pages, Netlify,
nginx на VPS). Перед деплоем поправьте `frontend/config.js`, если backend
живёт по другому домену, либо проставьте `window.__LIFON_API__` в `index.html`.

## Миграция со старого backend

Пользователи и лайки из старой базы переносятся `wrangler d1 export` →
импорт в новую базу. Старый формат хешей паролей нам неизвестен, поэтому
пользователям придётся зарегистрироваться заново (или мы добавим легаси-верификатор
рядом с PBKDF2, если ты пришлёшь старый код).
