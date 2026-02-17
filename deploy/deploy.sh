#!/bin/bash
# Deployment script for monAlpha — run on your Ubuntu server
# Usage: bash deploy.sh
#
# Required env vars (set in .env or export before running):
#   APP_DIR  — path to skillmarket directory
#   REPO_DIR — path to repo root

set -e

APP_DIR="${APP_DIR:?Set APP_DIR in .env (e.g. /home/deploy/monalpha/skillmarket)}"
REPO_DIR="${REPO_DIR:?Set REPO_DIR in .env (e.g. /home/deploy/monalpha)}"

echo "=== Deploying monAlpha ==="

# Pull latest code
echo "[1/5] Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

# Install dependencies
echo "[2/5] Installing dependencies..."
cd "$APP_DIR"
npm ci

# Build
echo "[3/5] Building Next.js app..."
npm run build

# Restart app with PM2
echo "[4/5] Restarting app..."
pm2 restart monalpha 2>/dev/null || pm2 start npm --name "monalpha" -- start
pm2 save

echo "[5/5] Done!"
echo ""
pm2 status monalpha
echo ""
echo "=== Deploy complete ==="
