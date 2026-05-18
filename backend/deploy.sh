#!/bin/bash
# deploy.sh — run on the server to install/update the backend.
# Usage: bash deploy.sh
set -e

APP_DIR="/var/www/lifonmusic/backend"
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO.git"  # <-- change this

# ── 1. Clone or pull ───────────────────────────────────────────────────────
if [ -d "$APP_DIR/.git" ]; then
    echo ">> Pulling latest..."
    cd "$APP_DIR"
    git pull
else
    echo ">> Cloning..."
    git clone "$REPO_URL" /tmp/lifonmusic_clone
    mkdir -p "$APP_DIR"
    cp -r /tmp/lifonmusic_clone/backend/. "$APP_DIR/"
    rm -rf /tmp/lifonmusic_clone
    cd "$APP_DIR"
fi

# ── 2. Install Node.js (if not installed) ─────────────────────────────────
if ! command -v node &>/dev/null; then
    echo ">> Installing Node.js 22 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# ── 3. Install PM2 (if not installed) ─────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
    echo ">> Installing PM2..."
    npm install -g pm2
fi

# ── 4. Create .env if missing ─────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
    echo ">> Creating .env from example — EDIT IT BEFORE CONTINUING!"
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    # Generate a random JWT_SECRET automatically
    SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
    sed -i "s/REPLACE_WITH_RANDOM_SECRET/$SECRET/" "$APP_DIR/.env"
    echo ""
    echo "  !!  .env created at $APP_DIR/.env"
    echo "  !!  Set ADMIN_BOOTSTRAP to your desired admin username, then re-run."
    echo ""
    read -p "Press Enter after editing .env to continue..."
fi

# ── 5. Install npm deps & build ────────────────────────────────────────────
echo ">> Installing dependencies..."
cd "$APP_DIR"
npm ci
echo ">> Building..."
npm run build

# ── 6. Start/restart with PM2 ─────────────────────────────────────────────
echo ">> Starting API with PM2..."
pm2 describe cupsize-api &>/dev/null \
    && pm2 restart cupsize-api \
    || pm2 start "$APP_DIR/dist/server.js" \
        --name cupsize-api \
        --cwd "$APP_DIR" \
        --max-memory-restart 300M

pm2 save
echo ">> PM2 status:"
pm2 list

# ── 7. Configure nginx ─────────────────────────────────────────────────────
if [ ! -f /etc/nginx/sites-available/lifonmusic ]; then
    echo ">> Installing nginx config..."
    cp "$APP_DIR/nginx.conf" /etc/nginx/sites-available/lifonmusic
    ln -sf /etc/nginx/sites-available/lifonmusic /etc/nginx/sites-enabled/lifonmusic
    nginx -t && systemctl reload nginx
    echo ">> nginx configured. Run: certbot --nginx -d test.lifonmusic.lol"
else
    echo ">> nginx config already exists, skipping (edit /etc/nginx/sites-available/lifonmusic manually if needed)"
    nginx -t && systemctl reload nginx
fi

echo ""
echo "✓ Done! API running at http://localhost:3001"
echo "  Check logs: pm2 logs cupsize-api"
