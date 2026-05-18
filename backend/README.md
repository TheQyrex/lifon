# cupsize-api

LifonMUSIC backend running on Cloudflare Workers.

- **Runtime:** Cloudflare Worker (Hono router)
- **Database:** D1 (SQLite)
- **Storage:** R2 (avatars, covers, audio, banner images, lyrics)
- **Auth:** PBKDF2-SHA256 password hashing, HS256 JWT (7-day TTL)
- **Rate limiting:** fixed-window via Workers KV

## First-time setup

```bash
cd backend
npm install
npx wrangler login

# 1. Create D1 database
npx wrangler d1 create cupsize-db
# → copy the printed database_id into wrangler.toml

# 2. Create KV namespaces
npx wrangler kv namespace create RATELIMIT
npx wrangler kv namespace create NOTIFICATIONS
# → copy both ids into wrangler.toml

# 3. Create the R2 bucket
npx wrangler r2 bucket create cupsize-media
# Optionally enable a public custom domain (Cloudflare dashboard → R2 → Settings)
# and put it in wrangler.toml as MEDIA_PUBLIC_BASE.

# 4. Secrets
npx wrangler secret put JWT_SECRET          # 32+ random bytes (openssl rand -base64 48)
npx wrangler secret put ADMIN_BOOTSTRAP     # username promoted to admin on registration (optional)

# 5. Apply migrations
npm run db:apply:remote

# 6. Deploy
npm run deploy
```

## API surface

Public:
- `POST /auth/register` — `{ username, password }` → `{ ok, token, user }`
- `POST /auth/login`    — `{ username, password }` → `{ ok, token, user }`
- `GET  /notification`  — current active broadcasts (banner + notification)
- `GET  /albums`        — full catalogue
- `GET  /albums/tracks/:id/lyrics` — LRC text

Authenticated (`Authorization: Bearer <jwt>`):
- `GET  /likes`              — liked track ids
- `POST /likes`              — `{ track_id }`
- `DELETE /likes`            — `{ track_id }`
- `POST /listens`            — `{ track_id, duration_ms }`
- `GET  /stats`              — top tracks + total listening time
- `GET  /profile`            — current user (incl. is_admin + avatar_url)
- `POST /profile/avatar`     — multipart `file=<image>`
- `DELETE /profile/avatar`

Admin only (must have `is_admin = 1`):
- `GET  /admin/stats`
- `GET  /admin/broadcasts`
- `POST /admin/broadcasts`   — `{ kind: 'notification' | 'banner', title, body?, image_key? }`
- `DELETE /admin/broadcasts/:id`
- `POST /admin/content/albums` / `PUT /admin/content/albums/:id` / `DELETE …`
- `POST /admin/content/tracks` / `PUT /admin/content/tracks/:id` / `DELETE …`
- `POST /admin/uploads`      — multipart `kind=avatar|cover|image|audio|lrc` + `file`

## Promoting users to admin

Either set `ADMIN_BOOTSTRAP` (works once, on registration of that username), or
toggle the flag directly:

```bash
npx wrangler d1 execute cupsize-db --remote --command \
  "UPDATE users SET is_admin = 1 WHERE username = 'videlsvet';"
```

## Migrating users from the previous backend

Password storage from the previous worker is unknown — users will need to reset.
The recommended migration path:

```sql
-- Run against the OLD database, export usernames + likes + listens.
-- Import into the new DB; users start without a password and must register again
-- with the same username (or you can pre-seed them and trigger a "forgot password" flow).
```

We chose this over guessing the old hash format because that risks locking
everyone out silently. If the legacy hashes are available somewhere, paste them
in and I'll add a verifier alongside PBKDF2 so the migration is invisible.
