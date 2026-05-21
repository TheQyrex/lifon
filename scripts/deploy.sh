#!/bin/bash
set -e

cd /var/www/lifonmusic

echo "==> git pull"
git pull

echo "==> frontend build"
cd frontend-react
npm ci --prefer-offline
npm run build
cd ..

echo "==> backend build"
cd backend
npm ci --prefer-offline
npm run build
cd ..

echo "==> pm2 restart"
pm2 restart ecosystem.config.cjs --update-env

echo "==> done"
